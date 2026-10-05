const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { boundedRead, hash, within } = require('./files.cjs');
const run = promisify(execFile);

const backgroundNames = ['Spotify', 'Teams', 'ms-teams', 'chrome', 'msedge', 'firefox', 'brave', 'opera'];
function optimizerSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Perfil do otimizador invalido.');
  if (value.profile && !['balanced', 'performance', 'economy'].includes(value.profile)) throw new Error('Perfil desconhecido.');
  return { profile: value.profile || 'balanced', memoryAuto: value.memoryAuto !== false, jvm: value.jvm !== false,
    priority: value.priority === true, power: value.power === true, monitor: value.monitor === true };
}
function recommendedHeap(hardware, profile) {
  const ram = Number(hardware?.ramGb);
  if (!Number.isFinite(ram) || ram < 6) return 0;
  const fraction = { balanced: .375, performance: .5, economy: .25 }[profile] || .375;
  const cap = profile === 'performance' ? 12 : profile === 'economy' ? 4 : 8;
  return Math.floor(Math.max(2, Math.min(cap, ram * fraction, ram - 4)) * 4) / 4;
}
class NativeOptimizer {
  constructor(executable, root) { this.executable = executable; this.root = path.join(root, 'optimizer'); this.hardware = null; }
  async call(args, timeout = 12000) {
    const { stdout } = await run(this.executable, args, { windowsHide: true, timeout, maxBuffer: 128 * 1024, encoding: 'utf8' });
    const result = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
    if (result.error) throw new Error(result.error);
    return result;
  }
  async detect() { this.hardware = await this.call(['--hardware'], 25000); return this.hardware; }
  async running(game) { return (await this.call(['--running', game])).running; }
  async status() {
    try {
      const data = JSON.parse(await boundedRead(path.join(this.root, 'status.json'), 8192));
      if (['watching', 'active'].includes(data.status) && (!Number.isFinite(Date.parse(data.updatedAt)) || Date.now() - Date.parse(data.updatedAt) > 60000))
        return { status: 'warning', warning: 'Monitor interrompido. Restaure a sessao antes de reativar.' };
      return data;
    }
    catch { return { status: 'idle' }; }
  }
  async start(game, preferences) {
    if (['watching', 'active', 'stopping'].includes((await this.status()).status)) throw new Error('O monitor ja esta ativo.');
    await fs.mkdir(this.root, { recursive: true });
    if ((await fs.lstat(this.root)).isSymbolicLink() || !within(await fs.realpath(path.dirname(this.root)), await fs.realpath(this.root))) throw new Error('Pasta do monitor insegura.');
    await fs.rm(path.join(this.root, 'stop'), { force: true });
    const config = optimizerSettings(preferences);
    if (![config.priority, config.power, config.monitor].some(Boolean)) throw new Error('Selecione uma opcao da sessao temporaria.');
    const digest = await hash(this.executable);
    const directory = path.join(path.dirname(this.root), 'native-runtime', digest);
    await fs.mkdir(directory, { recursive: true });
    if (!within(await fs.realpath(path.dirname(this.root)), await fs.realpath(directory))) throw new Error('Destino nativo inseguro.');
    const executable = path.join(directory, 'OrganicHelper.exe');
    try { await fs.copyFile(this.executable, executable, fs.constants.COPYFILE_EXCL); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    if (!within(await fs.realpath(directory), await fs.realpath(executable)) || await hash(executable) !== digest) throw new Error('Auxiliar nativo adulterado.');
    const child = spawn(executable, ['--watch', game, this.root, config.profile,
      String(config.priority), String(config.power), String(config.monitor)], { windowsHide: true, detached: true, stdio: 'ignore', shell: false });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref();
    for (let attempt = 0; attempt < 120; attempt++) {
      const value = await this.status();
      if (value.pid === child.pid && ['watching', 'active'].includes(value.status)) return value;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Nao foi possivel confirmar o inicio do monitor. Restaure a sessao antes de tentar novamente.');
  }
  async stop() { return this.call(['--stop', this.root]); }
  async processes() { return this.call(['--processes']); }
  async close(process) {
    if (!Number.isInteger(process?.pid) || process.pid <= 0 || !/^\d{10,20}$/.test(process.started)) throw new Error('Processo invalido.');
    return this.call(['--close', String(process.pid), process.started]);
  }
}
module.exports = { optimizerSettings, recommendedHeap, NativeOptimizer, backgroundNames };
