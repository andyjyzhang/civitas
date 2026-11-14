import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import { readFile, writeFile, mkdir, chmod, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { createCivitasClient, createAccountClient } from '@civitas/client';

const root = fileURLToPath(new URL('../../../', import.meta.url));
try { loadEnvFile(join(root, '.env')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
function serviceUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use an HTTP(S) service origin.');
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Remote services require HTTPS.');
  return url.origin;
}
const baseUrl = serviceUrl(process.env.CIVITAS_RELAY_URL || `http://127.0.0.1:${process.env.RELAY_PORT || 4000}`);
const webUrl = serviceUrl(process.env.WEB_ORIGIN || 'http://localhost:3000');
const uiFile = fileURLToPath(new URL('../ui/index.html', import.meta.url));
type Link = { token: string; spaceId: string };
let linked: Link | null = null;
let accountToken: string | null = null;
let window: BrowserWindow | null = null;
const credentialPath = () => join(app.getPath('userData'), 'agent.enc');
const privateEnv = () => join(app.getPath('userData'), 'agent.env');
const text = (value: unknown, max = 256) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\r\n\0]/.test(value)) throw new Error('Provide a valid value.');
  return value.trim();
};
function account() {
  if (!accountToken) throw new Error('Sign in before creating an agent.');
  return createAccountClient({ baseUrl, token: accountToken });
}
async function saveLink(next: Link) {
  linked = next;
  if (safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')) {
    await mkdir(dirname(credentialPath()), { recursive: true, mode: 0o700 });
    await writeFile(credentialPath(), safeStorage.encryptString(JSON.stringify({ ...next, baseUrl })), { mode: 0o600 });
    await chmod(credentialPath(), 0o600);
  }
}
function agent() {
  if (!linked) throw new Error('Link an agent first.');
  return { client: createCivitasClient({ baseUrl, token: linked.token }), spaceId: linked.spaceId };
}
async function status() {
  const overview = accountToken ? await account().overview() : null;
  if (!linked) return { linked: false, account: overview, baseUrl, webUrl };
  const snapshot = await createCivitasClient({ baseUrl, token: linked.token }).activity(linked.spaceId);
  return { linked: true, account: overview, baseUrl, webUrl, agentId: snapshot.currentAgentId, spaceId: linked.spaceId,
    spaceName: snapshot.space.name, storage: snapshot.storage,
    deliveries: snapshot.deliveries.length, retrieved: snapshot.deliveries.filter(item => item.retrievedAt).length,
    subscriptions: snapshot.subscriptions.filter(item => item.agentId === snapshot.currentAgentId).map(item => item.topic) };
}
function registerHandlers() {
  function handle(name: string, work: (...args: any[]) => unknown) {
    ipcMain.handle(`civitas:${name}`, async (event, ...args) => {
      if (!window || event.sender !== window.webContents || event.senderFrame?.url !== pathToFileURL(uiFile).href) throw new Error('Untrusted desktop frame.');
      try { return { ok: true, data: await work(...args) }; }
      catch (error) {
        const message = error instanceof Error ? error.message : 'Desktop operation failed.';
        return { ok: false, error: linked ? message.split(linked.token).join('[redacted]') : message };
      }
    });
  }
  handle('status', status);
  handle('login', async (email: unknown, password: unknown) => {
    if (typeof password !== 'string' || !password || password.length > 256) throw new Error('Enter your account password.');
    const result = await createAccountClient({ baseUrl }).login({ email: text(email), password });
    accountToken = result.token;
    return status();
  });
  handle('link', async (token: unknown, spaceId: unknown) => {
    const next = { token: text(token, 2048), spaceId: text(spaceId) };
    await createCivitasClient({ baseUrl, token: next.token }).activity(next.spaceId);
    await saveLink(next);
    return status();
  });
  handle('enroll', async (name: unknown, spaceId: unknown) => {
    const space = text(spaceId);
    const created = await account().createAgent(text(name, 100));
    await account().setGrant(space, { agentId: created.agentId, read: true, publish: true });
    await saveLink({ token: created.token, spaceId: space });
    return status();
  });
  handle('subscribe', async (topic: unknown) => { const { client, spaceId } = agent(); await client.subscribe(spaceId, { topic: text(topic, 128) }); return status(); });
  handle('retrieve', async () => {
    const { client, spaceId } = agent();
    const result = await client.getUpdates(spaceId, { limit: 100 });
    // Selected context stays out of desktop logs. Polling never executes content.
    return { count: result.items.length, nextCursor: result.nextCursor };
  });
  handle('configure', async () => {
    if (!linked) throw new Error('Link an agent first.');
    const envPath = privateEnv();
    await mkdir(dirname(envPath), { recursive: true, mode: 0o700 });
    // Node dotenv quoted values: generated credentials/space IDs cannot contain newlines.
    await writeFile(envPath, `CIVITAS_RELAY_URL=${JSON.stringify(baseUrl)}\nCIVITAS_AGENT_TOKEN=${JSON.stringify(linked.token)}\nCIVITAS_DEMO_SPACE_ID=${JSON.stringify(linked.spaceId)}\n`, { mode: 0o600 });
    await chmod(envPath, 0o600);
    const bridge = resolve(root, 'packages/cli/dist/index.js');
    return { envPath, config: JSON.stringify({ mcpServers: { civitas: { command: 'node', args: [`--env-file=${envPath}`, bridge] } } }, null, 2),
      note: 'Merge this entry with your MCP configuration. The private env file contains the credential; do not share it. Build the bridge before connecting. Node 22+ must be on your PATH.' };
  });
  handle('disconnect', async () => {
    if (accountToken) await account().logout().catch(() => {});
    linked = null; accountToken = null;
    await Promise.all([credentialPath(), privateEnv()].map(path => unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; })));
    return status();
  });
  handle('openWeb', async () => { await shell.openExternal(webUrl); return {}; });
}
function createWindow() {
  window = new BrowserWindow({ width: 540, height: 850, minWidth: 400, minHeight: 600, title: 'Civitas companion', backgroundColor: '#f6f8fa',
    webPreferences: { preload: fileURLToPath(new URL('./preload.cjs', import.meta.url)), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.on('closed', () => { window = null; });
  void window.loadFile(uiFile);
}
app.setName('Civitas');
await app.whenReady();
try {
  if (safeStorage.isEncryptionAvailable()) {
    const saved = JSON.parse(safeStorage.decryptString(await readFile(credentialPath())));
    if (saved.baseUrl === baseUrl) linked = { token: text(saved.token, 2048), spaceId: text(saved.spaceId) };
  }
} catch { /* Missing/unreadable saved credential simply requires relinking. */ }
registerHandlers();
createWindow();
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
