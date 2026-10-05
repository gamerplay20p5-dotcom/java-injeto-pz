const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');
const AdmZip = require('adm-zip');
const { dependencies, validateSettings, windowsArgs, commandFor, Profiles } = require('../src/main/profile.cjs');
const { within, hash } = require('../src/main/files.cjs');
const { inspectJar } = require('../src/main/jar.cjs');
const { libraryPaths, validateGame, modRoots, discover } = require('../src/main/discovery.cjs');
const catalog = require('../catalog.json').mods;
const config = { mainClass: 'zombie/gameStates/MainScreenState', classpath: ['.', 'projectzomboid.jar'],
  vmArgs: ['-Djava.awt.headless=true', '-Xmx3072m', '-Djava.library.path=win64/;.'],
  windows: { '6.1': { vmArgs: ['-XX:+UseG1GC'] }, '10.0.17134': { vmArgs: ['-XX:+UseZGC'] } } };

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-profile-'));
  const game = path.join(root, 'Jogo com espaços');
  await fs.mkdir(path.join(game, 'jre64/bin'), { recursive: true });
  await fs.writeFile(path.join(game, 'ProjectZomboid64.json'), JSON.stringify(config));
  await fs.writeFile(path.join(game, 'projectzomboid.jar'), 'vanilla');
  await fs.writeFile(path.join(game, 'jre64/bin/java.exe'), 'fixture');
  const mods = [];
  for (const mod of catalog) {
    const source = path.join(root, mod.jarName), zip = new AdmZip();
    zip.addFile('META-INF/MANIFEST.MF', Buffer.from(`Manifest-Version: 1.0\r\n${mod.premain ? `Premain-Class: ${mod.premain}\r\n` : ''}\r\n`));
    if (mod.premain) zip.addFile(mod.premain.replaceAll('.', '/') + '.class', Buffer.from('fixture'));
    zip.writeZip(source); mods.push({ ...mod, source });
  }
  return { root, game, mods, cleanup: async () => { assert(within(os.tmpdir(), root)); await fs.rm(root, { recursive: true, force: true }); } };
}

test('dependências do Viewpoint incluem ZombieBuddy uma única vez', () => {
  assert.deepEqual(dependencies(['viewpoint', 'zombiebuddy'], catalog), ['zombiebuddy', 'viewpoint']);
  assert.throws(() => dependencies(['inventado'], catalog));
  assert.throws(() => dependencies(['a'], [{ id: 'a', dependencies: ['a'] }]));
});

test('ordem dos cliques nao coloca ZombieBuddy antes do hook de exposicao Skinwalker', () => {
  for (const selection of [['viewpoint', 'skinwalker'], ['skinwalker', 'viewpoint'], ['zombiebuddy', 'skinwalker', 'viewpoint']]) {
    assert.deepEqual(dependencies(selection, catalog), ['skinwalker', 'zombiebuddy', 'viewpoint']);
  }
});
test('configuração aceita somente campos conhecidos; rejeita IDs/caminhos/memória inválidos', () => {
  assert.equal(validateSettings({ password: 'descartado' }, catalog).password, undefined);
  for (const input of [{ selected: ['alien'] }, { memoryGb: 33 }, { memoryGb: 3.5 }, { gamePath: {} }, { modRoots: Array(9).fill('x') }, { overrides: { alien: 'x.jar' } }, { overrides: [] }, { overrides: { viewpoint: 'x.jar' } }])
    assert.throws(() => validateSettings(input, catalog));
});
test('bibliotecas Steam são lidas com parser VDF, inclusive formato antigo', () => {
  assert.deepEqual(libraryPaths('"libraryfolders" { "0" { "path" "D:\\\\SteamLibrary" "apps" {"108600" "1"} } }'), ['D:\\SteamLibrary']);
  assert.deepEqual(libraryPaths('"LibraryFolders" { "1" "D:\\\\SteamLibrary" }'), ['D:\\SteamLibrary']);
});
test('caminhos não escapam do diretório pretendido nem confundem prefixos', () => {
  const root = path.resolve('runtime');
  assert(within(root, path.join(root, 'hash/Agent.jar')));
  assert(!within(root, path.join(root, '../secreto.jar')));
  assert(!within(root, root + '-outro'));
});
test('seleção numérica da configuração Windows e preservação do classpath/flags', () => {
  assert(windowsArgs(config, '10.0.22631').includes('-XX:+UseZGC'));
  assert(!windowsArgs(config, '10.0.10000').includes('-XX:+UseZGC'));
  const game = path.resolve('Jogo com espaços'), settings = validateSettings({}, catalog);
  const command = commandFor(config, game, [], settings, '10.0.22631');
  assert(command.args.includes('-Xmx3072m'));
  assert(command.args.includes(path.join(game, '.') + path.delimiter + path.join(game, 'projectzomboid.jar')));
});
test('agentes usam argumentos separados, sem cópia DLL; heap opcional não muda configuração original', () => {
  const command = commandFor(config, path.resolve('PZ'), [{ id: 'zombiebuddy', kind: 'agent', installed: 'C:\\Pasta com espaço\\ZombieBuddy.jar' }], { memoryGb: 6 }, '10.0.22631');
  assert(command.args.includes('-javaagent:C:\\Pasta com espaço\\ZombieBuddy.jar=policy=prompt'));
  assert(command.args.includes('-Xmx6g')); assert(!command.args.includes('-Xmx3072m'));
  assert(!command.args.some(arg => arg.includes('.dll'))); assert(config.vmArgs.includes('-Xmx3072m'));
  assert.throws(() => commandFor({ ...config, vmArgs: ['-javaagent:Outro.jar'] }, '.', [], {}, '10.0.22631'));
});
test('manifesto identifica premain e rejeita JAR de outro agente', async () => {
  const f = await fixture();
  try {
    const inspected = await inspectJar(f.mods[0].source, catalog[0].premain);
    assert.equal(inspected.premain, catalog[0].premain); assert.match(inspected.hash, /^[a-f0-9]{64}$/);
    await assert.rejects(inspectJar(f.mods[1].source, catalog[0].premain));
  } finally { await f.cleanup(); }
});

test('manifestos assinados grandes sao aceitos, com limite de descompressao', async () => {
  const f = await fixture();
  try {
    const zip = new AdmZip(f.mods[0].source);
    const head = `Manifest-Version: 1.0\r\nPremain-Class: ${catalog[0].premain}\r\n\r\n`;
    zip.updateFile('META-INF/MANIFEST.MF', Buffer.from(head + 'Name: outra/classe.class\r\n'.repeat(45000)));
    zip.writeZip(f.mods[0].source);
    assert.equal((await inspectJar(f.mods[0].source, catalog[0].premain)).premain, catalog[0].premain);
    zip.updateFile('META-INF/MANIFEST.MF', Buffer.alloc(4 * 1024 * 1024 + 1));
    zip.writeZip(f.mods[0].source);
    await assert.rejects(inspectJar(f.mods[0].source), /Manifesto/);
  } finally { await f.cleanup(); }
});
test('perfil prepara apenas JARs, preserva Workshop e JSON; remoção é restrita às cópias locais', async () => {
  const f = await fixture();
  try {
    const data = path.join(f.root, 'dados'), profiles = new Profiles(data, catalog);
    const settings = validateSettings({ selected: ['skinwalker', 'viewpoint'], gamePath: f.game }, catalog);
    const original = await hash(path.join(f.game, 'ProjectZomboid64.json'));
    const plan = await profiles.review(settings, { gamePath: f.game, mods: f.mods });
    await profiles.apply(plan.token, settings);
    const prepared = await profiles.manifest();
    assert.equal(prepared.mods.filter(mod => mod.kind === 'agent').length, 2);
    assert.equal(prepared.mods.find(mod => mod.id === 'viewpoint').installed, f.mods[1].source);
    const launch = await profiles.launchPlan(settings, { gamePath: f.game, mods: f.mods });
    assert.equal(launch.args.filter(arg => arg.startsWith('-javaagent:')).length, 2);
    assert.equal(await hash(path.join(f.game, 'ProjectZomboid64.json')), original);
    await profiles.remove(); await assert.rejects(fs.stat(path.join(data, 'runtime')));
    assert.equal(await hash(path.join(f.game, 'ProjectZomboid64.json')), original);
    assert(await fs.stat(f.mods[1].source));
  } finally { await f.cleanup(); }
});
test('revisão não pode ser reutilizada, expirada ou aplicada após mudança da seleção', async () => {
  const f = await fixture();
  try {
    const profiles = new Profiles(path.join(f.root, 'dados'), catalog), settings = validateSettings({ selected: ['skinwalker'] }, catalog);
    const discovery = { gamePath: f.game, mods: f.mods };
    const plan = await profiles.review(settings, discovery);
    await assert.rejects(profiles.apply(plan.token, { ...settings, memoryGb: 8 }));
    profiles.preview.expires = 0; await assert.rejects(profiles.apply(plan.token, settings));
    const valid = await profiles.review(settings, discovery); await profiles.apply(valid.token, settings);
    await assert.rejects(profiles.apply(valid.token, settings));
  } finally { await f.cleanup(); }
});
test('update da origem e adulteração da cópia exigem nova revisão', async () => {
  const f = await fixture();
  try {
    const profiles = new Profiles(path.join(f.root, 'dados'), catalog), settings = validateSettings({ selected: ['skinwalker'] }, catalog);
    const discovery = { gamePath: f.game, mods: f.mods };
    const plan = await profiles.review(settings, discovery); await profiles.apply(plan.token, settings);
    const prepared = await profiles.manifest();
    await fs.appendFile(prepared.mods[0].installed, 'adulterado');
    await assert.rejects(profiles.launchPlan(settings, discovery), /alterada/);
    await profiles.remove();
    const next = await profiles.review(settings, discovery);
    await fs.appendFile(f.mods[0].source, 'update');
    await assert.rejects(profiles.apply(next.token, settings), /atualizado/);
  } finally { await f.cleanup(); }
});

test('manifesto alterado nao escolhe outro destino ou tipo de Java; remocao continua possivel', async () => {
  const f = await fixture();
  try {
    const profiles = new Profiles(path.join(f.root, 'dados'), catalog), settings = validateSettings({ selected: ['skinwalker'] }, catalog);
    const plan = await profiles.review(settings, { gamePath: f.game, mods: f.mods });
    await profiles.apply(plan.token, settings);
    const prepared = await profiles.manifest();
    for (const change of [{ installed: f.mods[0].source }, { kind: 'workshop' }, { hash: 'invalido' }]) {
      const modified = structuredClone(prepared); Object.assign(modified.mods[0], change);
      await fs.writeFile(path.join(profiles.root, 'prepared.json'), JSON.stringify(modified));
      await assert.rejects(profiles.manifest(), /Perfil preparado/);
    }
    await profiles.remove(); assert.equal(await profiles.manifest(), null);
    assert(await fs.stat(f.mods[0].source));
  } finally { await f.cleanup(); }
});
test('classes soltas bloqueiam inicialização sem removê-las', async () => {
  const f = await fixture();
  try {
    await fs.mkdir(path.join(f.game, 'zombie'));
    const profiles = new Profiles(path.join(f.root, 'dados'), catalog);
    const settings = validateSettings({}, catalog), discovery = { gamePath: f.game, mods: [] };
    await profiles.launchPlan(settings, discovery);
    await fs.writeFile(path.join(f.game, 'zombie/Test.class'), 'fixture');
    await assert.rejects(profiles.launchPlan(validateSettings({}, catalog), { gamePath: f.game, mods: [] }), /classes soltas/);
    assert(await fs.stat(path.join(f.game, 'zombie')));
  } finally { await f.cleanup(); }
});
test('busca ignora árvores pesadas de media e valida cliente, não servidor', async () => {
  const f = await fixture();
  try {
    assert.equal(await validateGame(f.game), await fs.realpath(f.game));
    const root = path.join(f.root, 'mods');
    for (const dir of ['Teste/42', 'Teste/42/media/textures']) await fs.mkdir(path.join(root, dir), { recursive: true });
    await fs.writeFile(path.join(root, 'Teste/42/mod.info'), 'id=Teste');
    await fs.writeFile(path.join(root, 'Teste/42/media/textures/mod.info'), 'id=IGNORAR');
    const found = await modRoots(root); assert.equal(found.length, 1);
    await fs.writeFile(path.join(f.game, 'ProjectZomboid64.json'), JSON.stringify({ mainClass: 'zombie/network/GameServer' }));
    await assert.rejects(validateGame(f.game), /servidor/);
  } finally { await f.cleanup(); }
});

test('biblioteca Steam manual tem prioridade e encontra publicacao sem Workshop ID', async () => {
  const f = await fixture();
  try {
    const steam = path.join(f.root, 'Steam'), root = path.join(steam, 'steamapps/workshop/content/108600/1234567890/mods/Exemplo');
    await fs.mkdir(path.join(root, '42/media/java'), { recursive: true });
    await fs.writeFile(path.join(root, '42/mod.info'), 'id=FixtureUnknownWorkshop');
    await fs.copyFile(f.mods[0].source, path.join(root, '42/media/java/SkinwalkerAgent.jar'));
    const entry = { ...catalog[0], modId: 'FixtureUnknownWorkshop', workshopId: null };
    const found = await discover(validateSettings({ steamPath: steam, gamePath: f.game }, [entry]), [entry]);
    assert.equal(found.libraries[0], await fs.realpath(steam));
    assert.equal(found.mods[0].source, await fs.realpath(path.join(root, '42/media/java/SkinwalkerAgent.jar')));
  } finally { await f.cleanup(); }
});
