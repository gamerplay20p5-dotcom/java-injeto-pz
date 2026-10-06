const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Injection, configuredJson } = require('../src/main/injection.cjs');
const { within, hash } = require('../src/main/files.cjs');
const { recommendedHeap, optimizerSettings } = require('../src/main/optimizer.cjs');
const config = { mainClass: 'zombie/gameStates/MainScreenState', classpath: ['.', 'projectzomboid.jar'], vmArgs: ['-Xmx3072m', '-Djava.awt.headless=true'], windows: { '10.0': { vmArgs: ['-XX:+UseZGC'] } } };
const settings = { memoryGb: 0, optimizer: optimizerSettings() };
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-injection-'));
  const game = path.join(root, 'Jogo com espacos'), data = path.join(root, 'dados');
  await fs.mkdir(path.join(game, 'jre64/bin'), { recursive: true }); await fs.mkdir(data);
  const original = JSON.stringify(config, null, '\t') + '\r\n';
  const target = path.join(game, 'ProjectZomboid64.json');
  await fs.writeFile(target, original); await fs.writeFile(path.join(game, 'projectzomboid.jar'), 'vanilla'); await fs.writeFile(path.join(game, 'jre64/bin/java.exe'), 'fixture');
  return { root, game, target, original, service: new Injection(data), cleanup: async () => { assert(within(os.tmpdir(), root)); await fs.rm(root, { recursive: true, force: true }); } };
}
test('calibracao reserva RAM e perfis nao ultrapassam limites', () => {
  assert.equal(recommendedHeap({ ramGb: 16 }, 'balanced'), 6);
  assert.equal(recommendedHeap({ ramGb: 16 }, 'performance'), 8);
  assert.equal(recommendedHeap({ ramGb: 16 }, 'economy'), 4);
  assert.equal(recommendedHeap({ ramGb: 4 }, 'performance'), 0);
  assert.equal(recommendedHeap({ ramGb: 128 }, 'performance'), 12);
  assert.throws(() => optimizerSettings({ profile: 'inventado' }));
});
test('JSON preserva classpath e GC; adiciona agentes em ordem com politica prompt', () => {
  const mods = [{ id: 'skinwalker', kind: 'agent', installed: 'C:\\a\\SkinwalkerAgent.jar' }, { id: 'zombiebuddy', kind: 'agent', installed: 'C:\\b\\ZombieBuddy.jar', native: {} }, { id: 'viewpoint', kind: 'workshop' }];
  const value = configuredJson(config, mods, settings, { ramGb: 16 });
  assert.deepEqual(value.classpath, config.classpath); assert.deepEqual(value.windows, config.windows);
  assert(value.vmArgs.includes('-Xmx6144m')); assert(value.vmArgs.includes('-XX:SoftMaxHeapSize=4608m'));
  assert.deepEqual(value.vmArgs.filter(item => item.startsWith('-javaagent:')), ['-javaagent:C:\\a\\SkinwalkerAgent.jar']);
  assert(value.vmArgs.includes(`-agentpath:${path.resolve('zbNative.dll')}=policy=prompt`));
  assert(config.vmArgs.includes('-Xmx3072m'));
  const untouched = { ...config, vmArgs: [...config.vmArgs, '-XX:SoftMaxHeapSize=2048m'] };
  assert.deepEqual(configuredJson(untouched, [], { memoryGb: 0, optimizer: optimizerSettings({ memoryAuto: false, jvm: false }) }, null), untouched);
});
test('agente desconhecido e rejeitado tambem em variantes Windows', () => {
  assert.throws(() => configuredJson({ ...config, windows: { '1.0': { vmArgs: ['-javaagent:desconhecido.jar'] } } }, [], settings, null));
  assert.throws(() => configuredJson({ ...config, vmArgs: ['-javaagent:C:\\Outro\\FalsoSkinwalkerAgent.jar'] }, [], settings, null));
});
test('revisao nao escreve; injecao cria backup exato e restauracao devolve bytes originais', async () => {
  const f = await fixture(); try {
    const vanillaHash = await hash(path.join(f.game, 'projectzomboid.jar'));
    const plan = await f.service.review(f.game, [], settings, { ramGb: 16 });
    assert.equal(await fs.readFile(f.target, 'utf8'), f.original);
    const receipt = await f.service.apply(plan.token); assert.equal(receipt.status, 'injected');
    assert.equal(await fs.readFile(receipt.backupPath, 'utf8'), f.original);
    assert.equal((await f.service.restore()).status, 'restored');
    assert.equal(await fs.readFile(f.target, 'utf8'), f.original);
    assert.equal(await hash(path.join(f.game, 'projectzomboid.jar')), vanillaHash);
  } finally { await f.cleanup(); }
});
test('reaplicar ajustes nao sobrescreve o backup vanilla com JSON ja injetado', async () => {
  const f = await fixture(); try {
    const first = await f.service.review(f.game, [], settings, { ramGb: 16 }); await f.service.apply(first.token);
    const second = await f.service.review(f.game, [], { ...settings, optimizer: optimizerSettings({ profile: 'economy' }) }, { ramGb: 16 });
    await f.service.apply(second.token); await f.service.restore(); assert.equal(await fs.readFile(f.target, 'utf8'), f.original);
  } finally { await f.cleanup(); }
});
test('alteracao externa impede injecao e restauracao sem apagar mudancas', async () => {
  const f = await fixture(); try {
    const plan = await f.service.review(f.game, [], settings, null);
    await fs.appendFile(f.target, ' '); await assert.rejects(f.service.apply(plan.token), /mudou/);
    const next = await f.service.review(f.game, [], settings, { ramGb: 16 }); await f.service.apply(next.token);
    await fs.appendFile(f.target, ' '); const changed = await fs.readFile(f.target, 'utf8');
    await assert.rejects(f.service.restore(), /externamente/); assert.equal(await fs.readFile(f.target, 'utf8'), changed);
  } finally { await f.cleanup(); }
});
test('backup adulterado, traversal e token expirado sao recusados', async () => {
  const f = await fixture(); try {
    const plan = await f.service.review(f.game, [], settings, null); f.service.preview.expires = 0;
    await assert.rejects(f.service.apply(plan.token), /expirada/);
    const next = await f.service.review(f.game, [], settings, { ramGb: 16 }); const receipt = await f.service.apply(next.token);
    await fs.appendFile(receipt.backupPath, ' '); await assert.rejects(f.service.restore(), /adulterado/);
    const journal = JSON.parse(await fs.readFile(f.service.journal, 'utf8')); journal.backupName = '../fora.json';
    await fs.writeFile(f.service.journal, JSON.stringify(journal)); await assert.rejects(f.service.receipt(), /invalido/);
  } finally { await f.cleanup(); }
});
test('preload nao expoe abertura de jogo e processo nativo nunca invoca Steam', async () => {
  const source = await fs.readFile(path.join(__dirname, '../src/preload.cjs'), 'utf8');
  assert(!source.includes("'launch'")); assert(!source.includes("'launchPlan'"));
  const helper = await fs.readFile(path.join(__dirname, '../native/OrganicHelper.cs'), 'utf8');
  assert(!helper.includes('steam://')); assert(!helper.includes('rungameid')); assert(!helper.includes('EmptyWorkingSet'));
});

test('restauracao sem diferenca de bytes tambem libera remocao do perfil', async () => {
  const f = await fixture(); try {
    const original = JSON.stringify(config, null, 2) + '\n'; await fs.writeFile(f.target, original);
    const options = { memoryGb: 0, optimizer: optimizerSettings({ memoryAuto: false, jvm: false }) };
    const plan = await f.service.review(f.game, [], options, null); await f.service.apply(plan.token);
    const receipt = await f.service.receipt(); assert.equal(receipt.installedHash, receipt.originalHash);
    assert.equal((await f.service.restore()).status, 'restored');
  } finally { await f.cleanup(); }
});
