const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { atomicJson, boundedRead, hash, within, exists } = require('./files.cjs');
const { validateGame } = require('./discovery.cjs');
const { windowsArgs, commandFor, managedAgent, agentArgument } = require('./profile.cjs');
const { fileHash, validateEntries, nativePlan, snapshot, writePlan, restorePlan } = require('./native-kit.cjs');
const { recommendedHeap, optimizerSettings } = require('./optimizer.cjs');

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function configuredJson(base, mods, settings, hardware, gamePath = '.') {
  commandFor(base, gamePath, mods, settings);
  const result = structuredClone(base), optimizer = optimizerSettings(settings.optimizer);
  const heap = optimizer.memoryAuto ? recommendedHeap(hardware, optimizer.profile) : settings.memoryGb;
  function clean(args) {
    if (!Array.isArray(args) || args.some(value => typeof value !== 'string')) throw new Error('Argumentos JSON invalidos.');
    if (args.some(arg => /^-(javaagent|agentpath|agentlib):/.test(arg) && !managedAgent(arg)))
      throw new Error('Outro agente esta instalado. Revise antes de injetar.');
    return args.filter(arg => !/^-(javaagent|agentpath|agentlib):/.test(arg)
      && !(heap && /^-Xm[xs]/.test(arg)) && !(heap && /^-XX:SoftMaxHeapSize=/.test(arg)));
  }
  result.vmArgs = clean(result.vmArgs);
  for (const variant of Object.values(result.windows || {})) if (variant.vmArgs) variant.vmArgs = clean(variant.vmArgs);
  if (heap) result.vmArgs.push(`-Xmx${Math.round(heap * 1024)}m`);
  if (optimizer.jvm && heap && windowsArgs(result).includes('-XX:+UseZGC'))
    result.vmArgs.push(`-XX:SoftMaxHeapSize=${Math.round(heap * 1024 * (optimizer.profile === 'performance' ? 1 : .75))}m`);
  for (const mod of mods) if (mod.kind === 'agent') result.vmArgs.push(agentArgument(mod, gamePath));
  return result;
}
async function atomicBytes(file, value) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, value, { flag: 'wx' }); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}
class Injection {
  constructor(root) { this.root = root; this.journal = path.join(root, 'injection.json'); this.preview = null; }
  async receipt() {
    if (!await exists(this.journal)) return null;
    const receipt = JSON.parse(await boundedRead(this.journal));
    if (receipt.schema !== 1 || typeof receipt.gamePath !== 'string' || !/^[a-f0-9-]{36}\.json$/.test(receipt.backupName)
      || !/^[a-f0-9]{64}$/.test(receipt.originalHash) || !/^[a-f0-9]{64}$/.test(receipt.installedHash)
      || (receipt.previousHash != null && !/^[a-f0-9]{64}$/.test(receipt.previousHash))) throw new Error('Registro de backup invalido; preservado.');
    validateEntries(receipt.nativeFiles);
    return receipt;
  }
  async status() {
    const receipt = await this.receipt();
    if (!receipt) return { status: 'none' };
    let current = null;
    try { current = await hash(path.join(receipt.gamePath, 'ProjectZomboid64.json')); } catch { }
    const native = await Promise.all((receipt.nativeFiles || []).map(async entry => ({ ...entry, currentHash: await fileHash(path.join(receipt.gamePath, entry.name)) })));
    return { ...receipt, backupPath: path.join(this.root, 'backups', receipt.backupName),
      status: receipt.restoredAt && current === receipt.originalHash && native.every(entry => entry.currentHash === entry.originalHash) ? 'restored'
        : current === receipt.installedHash && native.every(entry => entry.currentHash === entry.installedHash) ? 'injected'
        : current === receipt.originalHash && native.every(entry => entry.currentHash === entry.originalHash) ? 'restored' : 'changed' };
  }
  async review(gamePath, prepared, settings, hardware) {
    gamePath = await validateGame(gamePath);
    const target = path.join(gamePath, 'ProjectZomboid64.json');
    if (!within(gamePath, await fs.realpath(target))) throw new Error('JSON fora da pasta do jogo.');
    const current = await boundedRead(target), currentHash = digest(current);
    const receipt = await this.receipt();
    let original = current;
    if (receipt && (await this.status()).status !== 'restored') {
      if (receipt.gamePath !== gamePath || currentHash !== receipt.installedHash) throw new Error('A configuracao mudou fora do utilitario. Backup preservado; nao sera sobrescrita.');
      const backup = path.join(this.root, 'backups', receipt.backupName);
      if (!within(await fs.realpath(this.root), await fs.realpath(backup))) throw new Error('Backup fora do utilitario.');
      original = await boundedRead(backup);
      if (digest(original) !== receipt.originalHash) throw new Error('Backup adulterado.');
    }
    const previous = receipt?.gamePath === gamePath && (await this.status()).status !== 'restored' ? receipt.nativeFiles : [];
    const native = await nativePlan(gamePath, prepared, previous, this.root);
    const desired = JSON.stringify(configuredJson(JSON.parse(original), prepared, settings, hardware, gamePath), null, 2) + '\n';
    const token = crypto.randomUUID();
    this.preview = { token, gamePath, target, currentHash, original, desired, receipt, native,
      modHashes: Object.fromEntries(prepared.map(mod => [mod.id, mod.hash])), expires: Date.now() + 300000 };
    return { token, target, destinations: [...prepared.filter(mod => mod.id !== 'zombiebuddy').map(mod => ({ name: mod.name, path: mod.installed, kind: mod.kind })),
      ...native.map(item => ({ name: item.name, path: item.target, kind: item.source ? 'Copia com backup' : 'Restauracao' }))],
      backup: path.join(this.root, 'backups'), heapGb: settings.optimizer?.memoryAuto ? recommendedHeap(hardware, settings.optimizer.profile) : settings.memoryGb,
      warnings: ['Um backup do JSON sera criado antes de qualquer alteracao.', 'O utilitario nao abre o jogo. Abra o PZ pela Steam depois da injecao.',
        'Viewpoint permanece na Workshop e exige autorizacao no ZombieBuddy. Windows usa a DLL oficial, nunca allow-all.'] };
  }
  async apply(token) {
    const plan = this.preview;
    this.preview = null;
    if (!plan || token !== plan.token || Date.now() > plan.expires) throw new Error('Revisao de injecao expirada.');
    if (!within(plan.gamePath, await fs.realpath(plan.target))) throw new Error('Destino de injecao inseguro.');
    if (await hash(plan.target) !== plan.currentHash) throw new Error('O JSON mudou depois da revisao.');
    const backupDirectory = path.join(this.root, 'backups');
    await fs.mkdir(backupDirectory, { recursive: true });
    if (!within(await fs.realpath(this.root), await fs.realpath(backupDirectory))) throw new Error('Destino de backup inseguro.');
    const backupName = `${crypto.randomUUID()}.json`;
    await fs.writeFile(path.join(backupDirectory, backupName), plan.original, { flag: 'wx' });
    const native = await snapshot(this.root, plan.native);
    const receipt = { schema: 1, gamePath: plan.gamePath, backupName, originalHash: digest(plan.original),
      installedHash: digest(plan.desired), previousHash: plan.currentHash, modHashes: plan.modHashes, nativeFiles: native.entries, createdAt: new Date().toISOString() };
    // Journal antes da escrita permite diagnosticar uma interrupcao sem perder o original.
    await atomicJson(this.journal, receipt);
    try {
      await writePlan(plan.native);
      await atomicBytes(plan.target, plan.desired);
    } catch (error) {
      // Roll back only files still carrying our known hashes; never overwrite an external change.
      const rollback = [];
      for (const item of native.rollback) {
        const current = await fileHash(item.target);
        if (current === item.desiredHash) continue;
        if (current !== item.beforeHash) throw new Error('Falha de injecao e alteracao externa. Backup preservado; use Restaurar backup.');
        rollback.push(item);
      }
      await writePlan(rollback);
      if (plan.receipt) await atomicJson(this.journal, plan.receipt);
      else await fs.rm(this.journal, { force: true });
      throw error;
    }
    return this.status();
  }
  async restore() {
    const receipt = await this.receipt();
    if (!receipt) throw new Error('Nenhum backup para restaurar.');
    const gamePath = await validateGame(receipt.gamePath), target = path.join(gamePath, 'ProjectZomboid64.json');
    if (!within(gamePath, await fs.realpath(target))) throw new Error('Destino de restauracao inseguro.');
    const file = path.join(this.root, 'backups', receipt.backupName);
    if (!within(await fs.realpath(this.root), await fs.realpath(file))) throw new Error('Backup fora do utilitario.');
    const original = await boundedRead(file);
    if (digest(original) !== receipt.originalHash) throw new Error('Backup adulterado; restauracao recusada.');
    const current = await hash(target);
    if (current !== receipt.originalHash && current !== receipt.installedHash && current !== receipt.previousHash) throw new Error('JSON alterado externamente. Restauracao automatica recusada para preservar sua mudanca.');
    const native = await restorePlan(this.root, gamePath, receipt.nativeFiles);
    await writePlan(native);
    if (current !== receipt.originalHash) await atomicBytes(target, original);
    await atomicJson(this.journal, { ...receipt, restoredAt: new Date().toISOString() });
    return this.status();
  }
}
module.exports = { Injection, configuredJson };
