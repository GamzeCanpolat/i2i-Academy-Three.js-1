import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const serverDir = path.join(distDir, 'server');
const hostingDir = path.join(distDir, '.openai');

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'server') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function toRoute(filePath) {
  const relative = path.relative(distDir, filePath).replaceAll(path.sep, '/');
  return relative === 'index.html' ? '/' : `/${relative}`;
}

const files = await listFiles(distDir);
const assets = {};

for (const file of files) {
  const bytes = await readFile(file);
  const route = toRoute(file);
  assets[route] = {
    body: bytes.toString('base64'),
    contentType: contentTypes[path.extname(file)] ?? 'application/octet-stream',
  };
}

await mkdir(serverDir, { recursive: true });
await mkdir(hostingDir, { recursive: true });

const hostingJson = await readFile(path.join(root, '.openai', 'hosting.json'), 'utf8');
await writeFile(path.join(hostingDir, 'hosting.json'), hostingJson);

const serverSource = `const ASSETS = ${JSON.stringify(assets)};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function responseFor(pathname) {
  const asset = ASSETS[pathname] ?? ASSETS['/'];
  return new Response(decodeBase64(asset.body), {
    headers: {
      'content-type': asset.contentType,
      'cache-control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    return responseFor(url.pathname);
  },
};
`;

await writeFile(path.join(serverDir, 'index.js'), serverSource);
