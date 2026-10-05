const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');
const { inspectJar } = require('./jar.cjs');
const { validateGame } = require('./discovery.cjs');
const { exists, boundedRead, hash, within, hasLooseClasses, atomicJson } = require('./files.cjs');

function dependencies(selected, catalog) {
  const byId = new Map(catalog.map(mod => [mod.id, mod]));
  const output = new Set(), visiting = new Set();
  function visit(id) {
    const mod = byId.get(id);
    if (!mod || visiting.has(id)) throw new Error('Depend\u00eancia inv\u00e1lida no cat\u00e1logo.');
    if (output.has(id)) return;
    visiting.add(id);
    for (const dep of mod.dependencies) visit(dep);
    visiting.delete(id); output.add(id);
  }
  // Ordem do catalogo, nao dos cliques: Skinwalker instala seu hook antes de ZombieBuddy carregar Exposer.
  const roots = [...selected].sort((left, right) => catalog.findIndex(mod => mod.id === left) - catalog.findIndex(mod => mod.id === right));
  for (const id of roots) visit(id);
  return [...output];
}

function validateSettings(value, catalog) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Configura\u00e7\u00e3o inv\u00e1lida.');
  const result = { gamePath: null, steamPath: null, modRoots: [], overrides: {}, selected: [], memoryGb: 0, theme: 'dark', reduceMotion: false };
  for (const key of ['gamePath', 'steamPath']) {
    if (value[key] != null && (typeof value[key] !== 'string' || value[key].length > 1024)) throw new Error('Caminho inv\u00e1lido.');
    result[key] = value[key] || null;
  }
  if (value.modRoots != null) {
    if (!Array.isArray(value.modRoots) || value.modRoots.length > 8 || value.modRoots.some(item => typeof item !== 'string' || item.length > 1024)) throw new Error('Use no m\u00e1ximo oito pastas de mods.');
    result.modRoots = value.modRoots;
  }
  const allowed = new Set(catalog.map(mod => mod.id));
  if (value.selected != null) {
    if (!Array.isArray(value.selected) || value.selected.length > catalog.length || value.selected.some(id => !allowed.has(id))) throw new Error('Sele\u00e7\u00e3o desconhecida.');
    result.selected = [...new Set(value.selected)];
  }
  if (value.overrides != null && (typeof value.overrides !== 'object' || Array.isArray(value.overrides))) throw new Error('Sele\u00e7\u00e3o de JAR inv\u00e1lida.');
  for (const [id, file] of Object.entries(value.overrides || {})) {
    if (!allowed.has(id) || catalog.find(mod => mod.id === id).kind !== 'agent' || typeof file !== 'string' || file.length > 1024) throw new Error('Sele\u00e7\u00e3o de JAR inv\u00e1lida.');
    result.overrides[id] = file;
  }
  if (value.memoryGb != null) {
    if (!Number.isInteger(value.memoryGb) || value.memoryGb < 0 || value.memoryGb > 32) throw new Error('Mem\u00f3ria fora do intervalo permitido.');
    result.memoryGb = value.memoryGb;
  }
  result.theme = value.theme === 'light' ? 'light' : 'dark';
  result.reduceMotion = value.reduceMotion === true;
  return result;
}

function windowsArgs(config, release = os.release()) {
  const version = text => text.split('.').map(Number);
  const compare = (a, b) => {
    const left = version(a), right = version(b);
    for (let i = 0; i < Math.max(left.length, right.length); i++) if ((left[i] || 0) !== (right[i] || 0)) return (left[i] || 0) - (right[i] || 0);
    return 0;
  };
  const keys = Object.keys(config.windows || {}).filter(key => /^\d+(\.\d+)*$/.test(key) && compare(key, release) <= 0).sort(compare);
  const options = config.windows?.[keys.at(-1)]?.vmArgs || [];
  return [...config.vmArgs, ...options];
}

function commandFor(config, gamePath, prepared, settings, release) {
  if (config.mainClass !== 'zombie/gameStates/MainScreenState' || !Array.isArray(config.vmArgs) || !Array.isArray(config.classpath)) throw new Error('JSON do cliente PZ inv\u00e1lido.');
  let vm = windowsArgs(config, release);
  if (vm.some(arg => typeof arg !== 'string') || config.classpath.some(item => typeof item !== 'string')) throw new Error('Argumentos vanilla inv\u00e1lidos.');
  // Apenas os agentes conhecidos s\u00e3o gerenciados aqui; outros agentes exigem revis\u00e3o, sem ocultar conflitos.
  const unmanaged = vm.filter(arg => /^-(javaagent|agentlib|agentpath):/.test(arg) && !/SkinwalkerAgent\.jar|ZombieBuddy\.jar|zbNative/i.test(arg));
  if (unmanaged.length) throw new Error('O JSON vanilla cont\u00e9m outro agente Java. Revise essa instala\u00e7\u00e3o antes de combinar patches.');
  vm = vm.filter(arg => !/^-(javaagent|agentlib|agentpath):/.test(arg));
  if (settings.memoryGb > 0) vm = vm.filter(arg => !/^-Xm[xs]/.test(arg)).concat(`-Xmx${settings.memoryGb}g`);
  for (const mod of prepared) if (mod.kind === 'agent') vm.push(`-javaagent:${mod.installed}${mod.id === 'zombiebuddy' ? '=policy=prompt' : ''}`);
  const cp = config.classpath.map(item => path.isAbsolute(item) ? item : path.join(gamePath, item)).join(path.delimiter);
  return { executable: path.join(gamePath, 'jre64/bin/java.exe'), cwd: gamePath,
    args: [...vm, '-cp', cp, 'zombie.gameStates.MainScreenState'] };
}

class Profiles {
  constructor(dataRoot, catalog) { this.root = dataRoot; this.catalog = catalog; this.preview = null; }
  async load() {
    let data = {};
    try { data = JSON.parse(await boundedRead(path.join(this.root, 'settings.json'))); } catch (err) { if (err.code !== 'ENOENT') throw new Error('Configura\u00e7\u00e3o local inv\u00e1lida. Preserve uma c\u00f3pia antes de redefinir.'); }
    return validateSettings(data, this.catalog);
  }
  async save(value) {
    const settings = validateSettings(value, this.catalog);
    await atomicJson(path.join(this.root, 'settings.json'), settings);
    this.preview = null;
    return settings;
  }
  async manifest() {
    try {
      const value = JSON.parse(await boundedRead(path.join(this.root, 'prepared.json')));
      if (value.schema !== 1 || typeof value.gamePath !== 'string' || !Array.isArray(value.mods) || value.mods.length > this.catalog.length)
        throw new Error('Estrutura de perfil invalida.');
      const ids = new Set();
      for (const mod of value.mods) {
        const known = this.catalog.find(item => item.id === mod.id);
        if (!known || ids.has(mod.id) || mod.kind !== known.kind || mod.name !== known.name || !/^[a-f0-9]{64}$/.test(mod.hash)
          || typeof mod.source !== 'string' || typeof mod.installed !== 'string') throw new Error('Componente de perfil invalido.');
        const expected = mod.kind === 'agent' ? path.join(this.root, 'runtime', mod.hash, known.jarName) : mod.source;
        if (mod.installed !== expected) throw new Error('Destino de perfil invalido.');
        ids.add(mod.id);
      }
      return value;
    }
    catch (err) { if (err.code === 'ENOENT') return null; throw new Error('Perfil preparado inv\u00e1lido; prepare os JARs novamente.'); }
  }
  async review(settings, discovery) {
    const ids = dependencies(settings.selected, this.catalog);
    const gamePath = await validateGame(discovery.gamePath || settings.gamePath);
    const mods = [];
    for (const id of ids) {
      const mod = discovery.mods.find(item => item.id === id);
      if (!mod?.source) throw new Error(`${this.catalog.find(item => item.id === id)?.name}: JAR n\u00e3o encontrado. Baixe pela Workshop ou selecione o arquivo.`);
      const info = await inspectJar(mod.source, mod.kind === 'agent' ? mod.premain : null);
      const installed = mod.kind === 'agent' ? path.join(this.root, 'runtime', info.hash, mod.jarName) : info.source;
      mods.push({ id, name: mod.name, kind: mod.kind, ...info, installed });
    }
    const token = crypto.randomUUID();
    this.preview = { token, mods, gamePath, selected: settings.selected,
      settingsHash: crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex'), expires: Date.now() + 5 * 60 * 1000 };
    return { token, mods, gamePath, warnings: [
      'Agentes Java podem executar c\u00f3digo com as permiss\u00f5es do seu usu\u00e1rio. SHA-256 identifica o arquivo; n\u00e3o certifica sua seguran\u00e7a.',
      'O launcher n\u00e3o ativa mods Lua no jogo. Ative os IDs e depend\u00eancias pela tela de mods ou pelo servidor.',
      ...(ids.includes('skinwalker') && ids.includes('zombiebuddy') ? ['Skinwalker + ZombieBuddy: coexist\u00eancia ainda requer teste em um save descart\u00e1vel.'] : [])
    ] };
  }
  async apply(token, settings) {
    const plan = this.preview;
    if (!plan || token !== plan.token || Date.now() > plan.expires || crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex') !== plan.settingsHash)
      throw new Error('Revis\u00e3o expirada ou configura\u00e7\u00e3o alterada. Revise novamente.');
    this.preview = null;
    for (const mod of plan.mods) {
      if (await hash(mod.source) !== mod.hash) throw new Error('O JAR foi atualizado ap\u00f3s sua revis\u00e3o. Revise o novo arquivo.');
      if (mod.kind !== 'agent') continue;
      await fs.mkdir(path.dirname(mod.installed), { recursive: true });
      if (!within(await fs.realpath(this.root), await fs.realpath(path.dirname(mod.installed)))) throw new Error('Destino local inseguro.');
      if (await exists(mod.installed)) {
        if (await hash(mod.installed) !== mod.hash) throw new Error('C\u00f3pia local adulterada. Remova o perfil antes de preparar novamente.');
        continue;
      }
      const temporary = `${mod.installed}.${crypto.randomUUID()}.tmp`;
      try {
        await fs.copyFile(mod.source, temporary, fs.constants.COPYFILE_EXCL);
        if (await hash(temporary) !== mod.hash) throw new Error('O JAR mudou durante a c\u00f3pia.');
        await fs.rename(temporary, mod.installed);
      } finally { await fs.rm(temporary, { force: true }); }
    }
    await atomicJson(path.join(this.root, 'prepared.json'), { schema: 1, gamePath: plan.gamePath, selected: plan.selected, mods: plan.mods });
    return { count: plan.mods.filter(mod => mod.kind === 'agent').length };
  }
  async launchPlan(settings, discovery) {
    const manifest = await this.manifest();
    const ids = dependencies(settings.selected, this.catalog);
    const gamePath = await validateGame(discovery.gamePath || settings.gamePath);
    if (ids.length && (!manifest || manifest.gamePath !== gamePath || JSON.stringify([...manifest.mods.map(mod => mod.id)].sort()) !== JSON.stringify([...ids].sort())))
      throw new Error('Prepare novamente os JARs deste perfil antes de iniciar.');
    const mods = ids.map(id => manifest.mods.find(mod => mod.id === id));
    for (const mod of mods) {
      const current = discovery.mods.find(item => item.id === mod.id);
      if (current?.error) throw new Error(`${mod.name}: JAR invalido; revise sua origem.`);
      if (current?.source !== mod.source || !await exists(mod.source) || await hash(mod.source) !== mod.hash) throw new Error(`${mod.name}: origem alterada; revise o novo JAR antes de iniciar.`);
      if (mod.kind === 'agent' && (!within(await fs.realpath(this.root), await fs.realpath(mod.installed)) || await hash(mod.installed) !== mod.hash)) throw new Error('C\u00f3pia preparada alterada. Remova e prepare novamente.');
    }
    if (await hasLooseClasses(path.join(gamePath, 'zombie'))) throw new Error('Foram encontradas classes soltas em uma pasta zombie do jogo. Revise os patches antigos antes de iniciar; elas podem sobrescrever o JAR vanilla.');
    const config = JSON.parse(await boundedRead(path.join(gamePath, 'ProjectZomboid64.json')));
    return { ...commandFor(config, gamePath, mods, settings), mods: mods.map(mod => mod.name),
      memoryGb: settings.memoryGb, warnings: ['O Steam precisa estar aberto. Este perfil n\u00e3o altera o bot\u00e3o Jogar da Steam nem o save.'] };
  }
  async remove() {
    const runtime = path.join(this.root, 'runtime');
    if (await exists(runtime)) {
      const resolvedRoot = await fs.realpath(this.root), resolved = await fs.realpath(runtime);
      if (!within(resolvedRoot, resolved) || resolved === resolvedRoot) throw new Error('Remo\u00e7\u00e3o recusada: destino fora do launcher.');
      await fs.rm(runtime, { recursive: true, force: true });
    }
    await fs.rm(path.join(this.root, 'prepared.json'), { force: true });
    this.preview = null;
  }
}

module.exports = { dependencies, validateSettings, windowsArgs, commandFor, Profiles };
