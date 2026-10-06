const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { hash, within, exists } = require('./files.cjs');

const names = ['ZombieBuddy.jar', 'zbNative.dll'];
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

async function fileHash(file) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024 ** 2) throw new Error('Arquivo nativo irregular ou grande demais.');
    return await hash(file);
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function inspectNative(source) {
  if (!await fileHash(source)) throw new Error('ZombieBuddy: zbNative.dll ausente. Selecione o JAR original da pasta libs da Workshop.');
  const stat = await fs.stat(source);
  if (stat.size < 128 || stat.size > 8 * 1024 ** 2) throw new Error('DLL ZombieBuddy fora dos limites.');
  const bytes = await fs.readFile(source), offset = bytes.readUInt32LE(60);
  if (bytes.toString('ascii', 0, 2) !== 'MZ' || offset > bytes.length - 24
    || bytes.readUInt32LE(offset) !== 0x4550 || bytes.readUInt16LE(offset + 4) !== 0x8664
    || !(bytes.readUInt16LE(offset + 22) & 0x2000)) throw new Error('ZombieBuddy: esperado PE DLL Windows x64.');
  return { source: await fs.realpath(source), hash: await hash(source), size: stat.size };
}
function validateEntries(entries = []) {
  if (!Array.isArray(entries) || entries.length > 2) throw new Error('Registro nativo invalido.');
  const seen = new Set();
  for (const entry of entries) {
    if (!names.includes(entry.name) || seen.has(entry.name)
      || ![entry.originalHash, entry.installedHash, entry.previousHash].every(value => value === null || sha(value))
      || (entry.originalHash && !/^[a-f0-9-]{36}\.native$/.test(entry.backupName || ''))
      || (!entry.originalHash && entry.backupName != null)) throw new Error('Registro nativo invalido.');
    seen.add(entry.name);
  }
  return entries;
}
async function backupFile(root, name, expected) {
  const file = path.join(root, 'backups', name);
  if (!within(await fs.realpath(root), await fs.realpath(file)) || await fileHash(file) !== expected)
    throw new Error('Backup nativo adulterado ou fora do utilitario.');
  return file;
}
async function nativePlan(gamePath, prepared, previous, root) {
  const zb = prepared.find(mod => mod.id === 'zombiebuddy');
  if (zb && !zb.native) throw new Error('Prepare ZombieBuddy novamente para revisar a DLL oficial.');
  if (zb && await exists(path.join(gamePath, 'ZombieBuddy.jar.new')))
    throw new Error('ZombieBuddy.jar.new pendente na pasta do jogo. Resolva a atualizacao do ZombieBuddy antes de injetar.');
  const output = [];
  for (const name of names) {
    const old = previous?.find(entry => entry.name === name);
    if (!zb && !old) continue;
    const target = path.join(gamePath, name), beforeHash = await fileHash(target);
    if (old && beforeHash !== old.installedHash && beforeHash !== old.originalHash)
      throw new Error(`${name} alterado externamente; arquivo preservado.`);
    const component = name.endsWith('.dll') ? zb?.native : zb;
    const desiredHash = component?.hash || old?.originalHash || null;
    const source = component?.installed || (old?.originalHash ? await backupFile(root, old.backupName, old.originalHash) : null);
    if (source && await fileHash(source) !== desiredHash) throw new Error('Componente nativo preparado alterado.');
    output.push({ name, target, source, beforeHash, desiredHash, originalHash: old ? old.originalHash : beforeHash, backupName: old?.backupName || null });
  }
  return output;
}
async function atomicCopy(source, target, expected) {
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.copyFile(source, temporary, fs.constants.COPYFILE_EXCL);
    if (await fileHash(temporary) !== expected) throw new Error('Arquivo mudou durante a copia.');
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
}
async function snapshot(root, plan) {
  const entries = [], rollback = [];
  for (const item of plan) {
    if (await fileHash(item.target) !== item.beforeHash) throw new Error('Arquivo nativo mudou depois da revisao.');
    let beforeBackup = null;
    if (item.beforeHash && (item.beforeHash !== item.desiredHash || (!item.backupName && item.originalHash))) {
      beforeBackup = `${crypto.randomUUID()}.native`;
      await atomicCopy(item.target, path.join(root, 'backups', beforeBackup), item.beforeHash);
    }
    const backupName = item.backupName || (item.originalHash ? beforeBackup : null);
    if (item.originalHash) await backupFile(root, backupName, item.originalHash);
    entries.push({ name: item.name, originalHash: item.originalHash, installedHash: item.desiredHash,
      previousHash: item.beforeHash, backupName });
    rollback.push({ ...item, source: beforeBackup ? path.join(root, 'backups', beforeBackup) : null,
      desiredHash: item.beforeHash, beforeHash: item.desiredHash });
  }
  return { entries, rollback };
}
async function writePlan(plan) {
  for (const item of plan) if (item.beforeHash !== item.desiredHash) {
    if (await fileHash(item.target) !== item.beforeHash) throw new Error(`${item.name}: alteracao externa; escrita recusada.`);
    if (item.source) await atomicCopy(item.source, item.target, item.desiredHash);
    else await fs.unlink(item.target);
  }
}
async function restorePlan(root, gamePath, entries) {
  const output = [];
  for (const entry of validateEntries(entries)) {
    const target = path.join(gamePath, entry.name), beforeHash = await fileHash(target);
    if (![entry.originalHash, entry.installedHash, entry.previousHash ?? entry.installedHash].includes(beforeHash))
      throw new Error(`${entry.name}: alterado externamente; restauracao recusada.`);
    const source = entry.originalHash ? await backupFile(root, entry.backupName, entry.originalHash) : null;
    output.push({ name: entry.name, target, beforeHash, source, desiredHash: entry.originalHash });
  }
  return output;
}
module.exports = { inspectNative, fileHash, validateEntries, nativePlan, snapshot, writePlan, restorePlan };
