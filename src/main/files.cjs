const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createReadStream } = require('node:fs');

function within(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

async function exists(file) { try { await fs.access(file); return true; } catch { return false; } }

async function boundedRead(file, max = 1024 * 1024) {
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > max) throw new Error('Arquivo ausente ou maior que o limite permitido.');
  return fs.readFile(file, 'utf8');
}

async function hash(file) {
  const digest = crypto.createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}

async function safeJar(file) {
  const real = await fs.realpath(file);
  const stat = await fs.stat(real);
  if (path.extname(real).toLowerCase() !== '.jar' || !stat.isFile() || stat.size < 22 || stat.size > 128 * 1024 * 1024)
    throw new Error('Selecione um JAR regular de at\u00e9 128 MiB.');
  return real;
}

async function hasLooseClasses(root) {
  if (!await exists(root)) return false;
  const queue = [root];
  let budget = 1000;
  while (queue.length) {
    if (--budget < 0) return true;
    const directory = queue.pop();
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || (entry.isFile() && /\.class$/i.test(entry.name))) return true;
      if (entry.isDirectory()) queue.push(path.join(directory, entry.name));
    }
  }
  return false;
}

// Rename no mesmo diret\u00f3rio: uma interrup\u00e7\u00e3o n\u00e3o deixa o JSON parcialmente escrito.
async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx' });
    await fs.rename(temporary, file);
  } finally { await fs.rm(temporary, { force: true }); }
}

module.exports = { within, exists, boundedRead, hash, safeJar, hasLooseClasses, atomicJson };
