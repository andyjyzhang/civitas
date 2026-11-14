// Git/tsc helpers: diff the agent's /work/ edits against the pristine consumer, and apply an
// approved patch to a private copy. The original consumer folder is never modified.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { ROOT } from './workspace.js';

// Show untrusted model/remote text without letting it drive the terminal.
export const safe = (text: string) => text.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, ch => `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`);

export function fileText(file: unknown): string | undefined {
  if (!file || typeof file !== 'object') return undefined;
  const content = (file as { content?: unknown }).content;
  if (Array.isArray(content)) return content.join('\n');
  if (typeof content === 'string') return content;
  return undefined;
}

export const fileData = (content: string) => {
  const now = new Date().toISOString();
  return { content, mimeType: 'text/plain', created_at: now, modified_at: now };
};

// Every path in the diff must stay inside the consumer copy.
export function patchPaths(diff: string) {
  const paths = new Set<string>();
  for (const line of diff.split('\n')) {
    const match = /^(?:--- |\+\+\+ )(\S+)/.exec(line) ?? /^diff --git (\S+) (\S+)/.exec(line);
    if (!match) continue;
    for (const raw of match.slice(1)) {
      if (!raw || raw === '/dev/null') continue;
      const path = raw.replace(/^[ab]\//, '');
      if (path.startsWith('/') || path.split('/').includes('..') || path.includes('\\') || path.startsWith('.git'))
        throw new Error(`Patch touches a path outside the consumer copy: ${safe(raw)}`);
      paths.add(path);
    }
  }
  if (!paths.size) throw new Error('Patch contains no file headers');
  return [...paths];
}

export function git(cwd: string, args: string[]) {
  return execFileSync('git', ['-c', 'user.name=civitas-adapter', '-c', 'user.email=adapter@example.invalid', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

export function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile())
    .map(entry => relative(dir, resolve(entry.parentPath, entry.name)).split('\\').join('/'));
}

// Fresh copy of the consumer in its own git repository, so git resolves paths against the copy.
function baselineCopy(consumerDir: string, target: string) {
  rmSync(target, { recursive: true, force: true });
  cpSync(consumerDir, target, { recursive: true });
  git(target, ['init', '-q']);
  git(target, ['add', '-A']);
  git(target, ['commit', '-q', '-m', 'consumer baseline']);
}

// Type-check a consumer folder with the workspace TypeScript (never executes the code).
export function typecheck(dir: string) {
  const files = listFiles(dir).filter(file => file.endsWith('.ts')).map(file => resolve(dir, file));
  try {
    execFileSync(process.execPath, [resolve(ROOT, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--module', 'nodenext',
      '--moduleResolution', 'nodenext', '--target', 'es2022', '--typeRoots', resolve(ROOT, 'node_modules/@types'), '--types', 'node', ...files],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return 'OK';
  } catch (error) {
    return String((error as { stdout?: string }).stdout || (error as Error).message).split(dir + '/').join('').trim().slice(0, 2000);
  }
}

// Unified diff of the agent's /work/ files against the pristine consumer, paths relative to it.
export function makeDiff(consumerDir: string, scratch: string, work: Record<string, string>) {
  mkdirSync(dirname(scratch), { recursive: true, mode: 0o700 });
  baselineCopy(consumerDir, scratch);
  try {
    for (const [rel, content] of Object.entries(work)) {
      if (!rel || rel.startsWith('/') || rel.split('/').includes('..') || rel.startsWith('.git')) throw new Error(`Refusing work path ${rel}`);
      mkdirSync(dirname(resolve(scratch, rel)), { recursive: true });
      writeFileSync(resolve(scratch, rel), content);
    }
    git(scratch, ['add', '-A']);
    const diff = git(scratch, ['diff', '--cached', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/']);
    return { diff, typecheck: diff.trim() ? typecheck(scratch) : 'not run' };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

/** Path containment, `git apply --check`, `git apply` on a fresh copy, then a tsc check of the result. */
export function applyToCopy(consumerDir: string, copy: string, diff: string) {
  patchPaths(diff);
  mkdirSync(dirname(copy), { recursive: true, mode: 0o700 });
  baselineCopy(consumerDir, copy);
  const patchFile = `${copy}.diff`;
  writeFileSync(patchFile, diff.endsWith('\n') ? diff : diff + '\n', { mode: 0o600 });
  try {
    git(copy, ['apply', '--check', '--recount', patchFile]);
    git(copy, ['apply', '--recount', patchFile]);
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr || (error as Error).message;
    throw new Error(`git apply failed: ${stderr.trim()}`);
  }
  return { copy, patchFile, stat: git(copy, ['diff', '--stat']).trim(), typecheck: typecheck(copy) };
}
