// A single portable file: no web server, external assets, credentials or network needed.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, '.local/demo');
await mkdir(out, { recursive: true });
const bundle = await build({
  stdin: { contents: "import {createRoot} from 'react-dom/client'; import Demo from './apps/web/app/demo/demo'; import './apps/web/app/globals.css'; createRoot(document.getElementById('root')).render(<Demo/>);", resolveDir: root, loader: 'tsx' },
  jsx: 'automatic', bundle: true, minify: true, write: false, outdir: out, platform: 'browser', format: 'iife', define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'standalone-links', setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'standalone' }));
    b.onLoad({ filter: /.*/, namespace: 'standalone' }, () => ({ contents: "import React from 'react'; export default function Link({href,children,prefetch,replace,scroll,...rest}) {return React.createElement('a',{...rest,href},children)}", loader: 'js', resolveDir: root }));
  } }],
});
const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
const css = bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
await writeFile(path.join(out, 'civitas-demo.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Civitas — Watch demo</title><style>:root{--font-geist-sans:Arial,sans-serif;--font-geist-mono:monospace}${css}</style><div id="root"></div><script>${js}</script></html>`);
console.log('Offline demo: .local/demo/civitas-demo.html');
