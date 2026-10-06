const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { hash, within } = require('../src/main/files.cjs');
const { Injection } = require('../src/main/injection.cjs');
const { inspectNative } = require('../src/main/native-kit.cjs');
const { Profiles, validateSettings } = require('../src/main/profile.cjs');
const { fixture } = require('../tools/test-fixture.cjs');
const catalog = require('../catalog.json').mods;
async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-native-kit-')), f = await fixture(root);
  const settings = validateSettings(JSON.parse(await fs.readFile(path.join(f.data, 'settings.json'), 'utf8')), catalog);
  settings.selected = ['viewpoint'];
  const { discover } = require('../src/main/discovery.cjs');
  const profiles = new Profiles(f.data, catalog), found = await discover(settings, catalog);
  const reviewed = await profiles.review(settings, found); await profiles.apply(reviewed.token, settings);
  return { ...f, root, settings, profiles, mods: (await profiles.manifest()).mods, injection: new Injection(f.data),
    close: async () => { assert(within(os.tmpdir(), root)); await fs.rm(root, { recursive: true, force: true }); } };
}
test('DLL ausente, truncada e arquitetura incorreta sao recusadas', async () => {
  const f = await setup(); try {
    const source = f.mods.find(mod => mod.native).native.source;
    for (const bytes of [Buffer.from('MZ'), Buffer.alloc(512), (() => { const b = require('./native-fixture.cjs').dll(); b.writeUInt16LE(0x14c, 132); return b; })()]) {
      await fs.writeFile(source, bytes); await assert.rejects(inspectNative(source));
    }
    await fs.unlink(source); await assert.rejects(inspectNative(source), /ausente/);
  } finally { await f.close(); }
});
test('injecao nativa nao duplica agentes; restore remove somente as novas copias', async () => {
  const f = await setup(); try {
    const review = await f.injection.review(f.game, f.mods, f.settings, null);
    assert(review.destinations.some(item => item.path === path.join(f.game, 'zbNative.dll')));
    await f.injection.apply(review.token);
    const json = JSON.parse(await fs.readFile(f.target));
    assert.equal(json.vmArgs.filter(arg => arg.startsWith('-agentpath:')).length, 1);
    assert(!json.vmArgs.some(arg => arg.includes('-javaagent:') && arg.includes('ZombieBuddy')));
    for (const entry of (await f.injection.receipt()).nativeFiles) assert.equal(await hash(path.join(f.game, entry.name)), entry.installedHash);
    assert.equal((await f.injection.restore()).status, 'restored');
    assert.equal(await fs.readFile(f.target, 'utf8'), f.original);
    for (const name of ['ZombieBuddy.jar', 'zbNative.dll']) await assert.rejects(fs.stat(path.join(f.game, name)), /ENOENT/);
    assert(await fs.stat(f.mods.find(mod => mod.native).source));
  } finally { await f.close(); }
});
test('copias preexistentes sao restauradas byte a byte mesmo apos reaplicar', async () => {
  const f = await setup(); try {
    for (const name of ['ZombieBuddy.jar', 'zbNative.dll']) await fs.writeFile(path.join(f.game, name), `original ${name}`);
    for (let i = 0; i < 2; i++) {
      const review = await f.injection.review(f.game, f.mods, f.settings, null); await f.injection.apply(review.token);
    }
    await f.injection.restore();
    for (const name of ['ZombieBuddy.jar', 'zbNative.dll']) assert.equal(await fs.readFile(path.join(f.game, name), 'utf8'), `original ${name}`);
  } finally { await f.close(); }
});
test('desmarcar ZombieBuddy reverte par nativo e preserva backup original', async () => {
  const f = await setup(); try {
    const review = await f.injection.review(f.game, f.mods, f.settings, null); await f.injection.apply(review.token);
    const next = await f.injection.review(f.game, [], f.settings, null); await f.injection.apply(next.token);
    await assert.rejects(fs.stat(path.join(f.game, 'zbNative.dll')), /ENOENT/);
    await f.injection.restore(); assert.equal(await fs.readFile(f.target, 'utf8'), f.original);
  } finally { await f.close(); }
});
test('DLL alterada externamente bloqueia toda restauracao antes de modificar JSON', async () => {
  const f = await setup(); try {
    const review = await f.injection.review(f.game, f.mods, f.settings, null); await f.injection.apply(review.token);
    const before = await hash(f.target); await fs.appendFile(path.join(f.game, 'zbNative.dll'), 'externo');
    await assert.rejects(f.injection.restore(), /externamente/); assert.equal(await hash(f.target), before);
  } finally { await f.close(); }
});
test('falha apos copiar JAR reverte arquivos ja alterados sem perder original', async () => {
  const f = await setup(); try {
    const review = await f.injection.review(f.game, f.mods, f.settings, null);
    await fs.appendFile(f.mods.find(mod => mod.native).native.installed, 'alterado');
    await assert.rejects(f.injection.apply(review.token), /mudou/);
    await assert.rejects(fs.stat(path.join(f.game, 'ZombieBuddy.jar')), /ENOENT/);
    assert.equal(await fs.readFile(f.target, 'utf8'), f.original);
    assert.equal((await f.injection.status()).status, 'none');
  } finally { await f.close(); }
});
test('journal interrompido e backup nativo adulterado possuem recuperacao segura', async () => {
  const f = await setup(); try {
    await fs.writeFile(path.join(f.game, 'zbNative.dll'), 'original');
    const review = await f.injection.review(f.game, f.mods, f.settings, null); await f.injection.apply(review.token);
    const receipt = await f.injection.receipt();
    await fs.writeFile(f.target, f.original); // Interrupted just before writing JSON.
    assert.equal((await f.injection.status()).status, 'changed');
    const backup = path.join(f.data, 'backups', receipt.nativeFiles.find(item => item.name === 'zbNative.dll').backupName);
    await fs.appendFile(backup, 'alterado');
    await assert.rejects(f.injection.restore(), /adulterado/);
    await fs.writeFile(backup, 'original'); assert.equal((await f.injection.restore()).status, 'restored');
  } finally { await f.close(); }
});
test('JAR.new e registro de destino arbitrario sao bloqueados sem apagar nada', async () => {
  const f = await setup(); try {
    await fs.writeFile(path.join(f.game, 'ZombieBuddy.jar.new'), 'pendente');
    await assert.rejects(f.injection.review(f.game, f.mods, f.settings, null), /pendente/);
    await fs.unlink(path.join(f.game, 'ZombieBuddy.jar.new'));
    const review = await f.injection.review(f.game, f.mods, f.settings, null); await f.injection.apply(review.token);
    const receipt = await f.injection.receipt(); receipt.nativeFiles[0].name = '../outro.jar';
    await fs.writeFile(f.injection.journal, JSON.stringify(receipt)); await assert.rejects(f.injection.restore(), /invalido/);
  } finally { await f.close(); }
});
