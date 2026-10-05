const fs = require('node:fs/promises');
const path = require('node:path');
const AdmZip = require('adm-zip');
const catalog = require('../catalog.json').mods;

// Instalacao descartavel: testes de interface nunca escrevem na pasta real do PZ.
async function fixture(root) {
  const game = path.join(root, 'PZ de teste'), steam = path.join(root, 'Steam de teste'), data = path.join(root, 'perfil');
  const target = path.join(game, 'ProjectZomboid64.json');
  const original = JSON.stringify({ mainClass: 'zombie/gameStates/MainScreenState', classpath: ['.', 'projectzomboid.jar'],
    vmArgs: ['-Xmx3072m', '-Djava.awt.headless=true'], windows: { '10.0': { vmArgs: ['-XX:+UseZGC'] } } }, null, '\t') + '\r\n';
  await fs.mkdir(path.join(game, 'jre64/bin'), { recursive: true }); await fs.mkdir(data);
  await fs.writeFile(target, original); await fs.writeFile(path.join(game, 'projectzomboid.jar'), 'fixture vanilla'); await fs.writeFile(path.join(game, 'jre64/bin/java.exe'), 'fixture; nunca executar');
  const overrides = {};
  for (const mod of catalog) {
    const base = path.join(steam, 'steamapps/workshop/content/108600', mod.workshopId || '999999', 'mods', mod.name);
    await fs.mkdir(path.join(base, '42'), { recursive: true }); await fs.writeFile(path.join(base, '42/mod.info'), `name=${mod.name}\nid=${mod.modId}\n`);
    const jar = path.join(base, mod.jarPaths[0]); await fs.mkdir(path.dirname(jar), { recursive: true });
    const zip = new AdmZip(); zip.addFile('META-INF/MANIFEST.MF', Buffer.from(`Manifest-Version: 1.0\r\nImplementation-Version: 1.0.0\r\n${mod.premain ? `Premain-Class: ${mod.premain}\r\n` : ''}\r\n`));
    if (mod.premain) zip.addFile(mod.premain.replace(/\./g, '/') + '.class', Buffer.from('fixture; nunca executar'));
    await fs.writeFile(jar, zip.toBuffer());
    if (mod.kind === 'agent') overrides[mod.id] = jar;
  }
  await fs.writeFile(path.join(data, 'settings.json'), JSON.stringify({ gamePath: game, steamPath: steam, selected: [], overrides, optimizer: { memoryAuto: false, jvm: false } }));
  return { game, data, target, original };
}
module.exports = { fixture };
