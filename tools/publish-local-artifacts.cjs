const fs = require('node:fs/promises');
const path = require('node:path');
const { hash } = require('../src/main/files.cjs');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const names = [`Java-Injeto-PZ-${version}-Windows.exe`, `Java-Injeto-PZ-${version}-Setup.exe`];

async function checksums(release) {
  const lines = [];
  for (const name of names) {
    const file = path.join(release, name);
    if ((await fs.stat(file)).size < 10 * 1024 * 1024) throw new Error(`Executavel incompleto: ${name}`);
    const handle = await fs.open(file, 'r');
    try {
      const header = Buffer.alloc(2);
      await handle.read(header, 0, 2, 0);
      if (header.toString('ascii') !== 'MZ') throw new Error(`Formato executavel invalido: ${name}`);
    } finally { await handle.close(); }
    lines.push(`${await hash(file)}  ${name}`);
  }
  await fs.writeFile(path.join(release, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
  return names;
}

async function main() {
  const release = path.join(root, 'release');
  await checksums(release);
  await fs.copyFile(path.join(release, names[0]), path.join(root, 'Java Injeto.exe'));
  await fs.copyFile(path.join(release, names[1]), path.join(root, 'Instalar Java Injeto.exe'));
  console.log('Prontos na raiz: Java Injeto.exe (portatil) e Instalar Java Injeto.exe (instalador).');
}

module.exports = { checksums };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
