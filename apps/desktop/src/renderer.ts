type Result = { ok: boolean; data?: any; error?: string };
declare global {
  interface Window { civitas: {
    status(): Promise<Result>; login(email: string, password: string): Promise<Result>;
    link(token: string, spaceId: string): Promise<Result>; enroll(name: string, spaceId: string): Promise<Result>;
    subscribe(topic: string): Promise<Result>; retrieve(): Promise<Result>; configure(): Promise<Result>;
    disconnect(): Promise<Result>; openWeb(): Promise<Result>;
  } }
}
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => element<HTMLInputElement>(id).value;
function render(data: any) {
  element('connection-state').textContent = data.linked ? 'Connected' : 'No agent linked';
  element('details').textContent = data.linked ? `${data.agentId} in ${data.spaceName || data.spaceId}. Space activity: ${data.deliveries} deliveries, ${data.retrieved} retrieved. Your topics: ${data.subscriptions.join(', ') || 'none'}.` : 'Sign in to create an agent, or link an existing key.';
  element('storage').textContent = data.storage === 'postgres' ? 'PostgreSQL: relay history survives restarts.' : data.linked ? 'Memory storage: relay restart clears history and account links.' : '';
  element('linked-actions').hidden = !data.linked;
  element('signin-section').hidden = Boolean(data.account);
  element('enroll-section').hidden = !data.account;
  element('endpoint').textContent = data.baseUrl;
  if (data.account) {
    const select = element<HTMLSelectElement>('account-space');
    const previous = select.value;
    select.replaceChildren();
    for (const space of (data.account.spaces || []).filter((space: { role: string }) => space.role === 'owner')) {
      const option = document.createElement('option');
      option.value = space.spaceId; option.textContent = space.name; select.append(option);
    }
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
}
async function run(action: () => Promise<Result>, renderStatus = true) {
  element('message').textContent = '';
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(button => button.disabled = true);
  try {
    const result = await action();
    if (!result.ok) throw new Error(result.error || 'The operation failed.');
    if (renderStatus) render(result.data);
    return result.data;
  } catch (error) { element('message').textContent = error instanceof Error ? error.message : 'Unable to reach the desktop bridge.'; }
  finally { buttons.forEach(button => button.disabled = false); }
}
element('signin').addEventListener('submit', event => {
  event.preventDefault();
  const email = value('email'), password = value('password');
  element<HTMLInputElement>('password').value = '';
  void run(() => window.civitas.login(email, password));
});
element('link').addEventListener('submit', event => {
  event.preventDefault();
  const token = value('token'); element<HTMLInputElement>('token').value = '';
  void run(() => window.civitas.link(token, value('space')));
});
element('enroll').addEventListener('submit', event => { event.preventDefault(); void run(() => window.civitas.enroll(value('agent-name'), value('account-space'))); });
element('subscribe').addEventListener('submit', event => { event.preventDefault(); void run(() => window.civitas.subscribe(value('topic'))); });
element('refresh').addEventListener('click', () => void run(() => window.civitas.status()));
element('retrieve').addEventListener('click', () => void run(async () => {
  const result = await window.civitas.retrieve();
  if (!result.ok) return result;
  const status = await window.civitas.status();
  element('message').textContent = `Retrieved ${result.data.count} deliveries${result.data.nextCursor ? ' on the first page; use MCP to continue' : ''}. Retrieved context never runs automatically.`;
  return status;
}));
element('configure').addEventListener('click', () => void run(async () => {
  const result = await window.civitas.configure();
  if (result.ok) {
    element('config-section').hidden = false;
    element('config').textContent = result.data.config;
    element('config-note').textContent = result.data.note;
  }
  return result;
}, false));
element('open-web').addEventListener('click', () => void run(() => window.civitas.openWeb(), false));
element('disconnect').addEventListener('click', () => void run(async () => {
  const result = await window.civitas.disconnect(); element('config-section').hidden = true; element('config').textContent = ''; return result;
}));
void run(() => window.civitas.status());
export {};
