import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage']);
const files = [];
const errors = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(location);
    else if (entry.isFile()) files.push(location);
  }
}

await walk(root);
for (const file of files) {
  const relative = path.relative(root, file);
  if (file.endsWith('.json')) {
    try {
      JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      errors.push(`${relative}: invalid JSON (${error.message})`);
    }
  }
  if (!file.endsWith('.md')) continue;
  // Check simple inline local file links, excluding fenced code examples.
  const markdown = (await readFile(file, 'utf8')).replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:|^#|^\//i.test(target)) continue;
    try {
      const destination = decodeURIComponent(target.split(/[?#]/)[0]);
      await stat(path.resolve(path.dirname(file), destination));
    } catch {
      errors.push(`${relative}: missing local link target ${target}`);
    }
  }
}

const names = new Set();
for (const group of ['apps', 'packages']) {
  for (const entry of await readdir(path.join(root, group), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(root, group, entry.name, 'package.json');
    try {
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (!manifest.name || names.has(manifest.name)) throw new Error('missing or duplicate package name');
      if (manifest.private !== true) throw new Error('workspace must remain private until release setup');
      names.add(manifest.name);
      await stat(path.join(root, group, entry.name, 'README.md'));
    } catch (error) {
      errors.push(`${group}/${entry.name}: ${error.message}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Repository checks passed: ${names.size} workspaces; JSON and local Markdown file links checked.`);
}
