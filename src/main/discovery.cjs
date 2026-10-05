const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const vdf = require('vdf-parser');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const { exists, boundedRead, safeJar } = require('./files.cjs');

function libraryPaths(text) {
  const parsed = vdf.parse(text);
  const root = parsed.libraryfolders || parsed.LibraryFolders || {};
  return Object.entries(root).filter(([key]) => /^\d+$/.test(key)).map(([, entry]) => typeof entry === 'string' ? entry : entry?.path)
    .filter(item => typeof item === 'string' && item.length < 1024).map(item => path.win32.normalize(item));
}

async function steamPaths(settings = {}) {
  const candidates = [settings.steamPath, process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Steam'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam'), 'C:\\Program Files (x86)\\Steam'].filter(Boolean);
  if (process.platform === 'win32') {
    try {
      const { stdout } = await run('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, timeout: 3000 });
      const found = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
      if (found) settings.steamPath ? candidates.splice(1, 0, found[1].trim()) : candidates.unshift(found[1].trim());
    } catch { /* Caminho manual e padr\u00f5es continuam dispon\u00edveis. */ }
  }
  const roots = new Set();
  for (const candidate of candidates) {
    if (!await exists(candidate)) continue;
    roots.add(await fs.realpath(candidate));
    try { for (const item of libraryPaths(await boundedRead(path.join(candidate, 'steamapps/libraryfolders.vdf')))) if (await exists(item)) roots.add(await fs.realpath(item)); } catch { }
  }
  return [...roots];
}

async function validateGame(root) {
  if (typeof root !== 'string' || !root || root.length > 1024) throw new Error('Selecione a pasta do Project Zomboid.');
  root = await fs.realpath(root);
  for (const file of ['projectzomboid.jar', 'ProjectZomboid64.json', 'jre64/bin/java.exe'])
    if (!await exists(path.join(root, file))) throw new Error('Esta pasta n\u00e3o cont\u00e9m o cliente Windows completo do PZ.');
  const launcher = JSON.parse(await boundedRead(path.join(root, 'ProjectZomboid64.json')));
  if (launcher.mainClass !== 'zombie/gameStates/MainScreenState') throw new Error('O launcher aceita o cliente, n\u00e3o o servidor dedicado.');
  return root;
}

// Visita apenas diret\u00f3rios estruturais. Nunca entra nas \u00e1rvores de media/modelos/mapas.
async function modRoots(root, depth = 0, result = [], budget = { left: 1800 }) {
  if (depth > 6 || budget.left-- <= 0) return result;
  let entries;
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return result; }
  if (entries.some(entry => entry.name.toLowerCase() === 'mod.info')) {
    result.push(root);
    if (['42', 'common'].includes(path.basename(root).toLowerCase())) return result;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink() || ['media', 'java', 'node_modules', '.git', 'tools', 'tests', 'libs'].includes(entry.name.toLowerCase())) continue;
    await modRoots(path.join(root, entry.name), depth + 1, result, budget);
  }
  return result;
}

async function discover(settings, catalog, progress = () => {}) {
  progress('Procurando bibliotecas Steam');
  const libraries = await steamPaths(settings);
  const gameCandidates = [settings.gamePath, ...libraries.map(root => path.join(root, 'steamapps/common/ProjectZomboid'))].filter(Boolean);
  let gamePath = null;
  for (const candidate of gameCandidates) { try { gamePath = await validateGame(candidate); break; } catch { } }
  progress('Localizando JARs da Workshop');
  const generic = [path.join(os.homedir(), 'Zomboid/Workshop'), path.join(os.homedir(), 'Zomboid/mods'), ...(settings.modRoots || [])];
  const manifests = [];
  for (const root of generic) for (const item of await modRoots(root)) {
    try { manifests.push({ root: item, text: await boundedRead(path.join(item, 'mod.info'), 65536) }); } catch { }
  }
  const mods = [];
  for (const mod of catalog) {
    let source = null, modRoot = null;
    const locations = [];
    const workshopManifests = [];
    if (settings.overrides?.[mod.id]) locations.push({ file: settings.overrides[mod.id], root: null });
    if (mod.workshopId) for (const lib of libraries) {
      const itemRoot = path.join(lib, 'steamapps/workshop/content/108600', mod.workshopId, 'mods');
      for (const root of await modRoots(itemRoot)) workshopManifests.push({ root, text: await boundedRead(path.join(root, 'mod.info'), 65536).catch(() => '') });
    }
    // A versao assinada na Workshop tem prioridade sobre copias de desenvolvimento locais.
    for (const info of [...workshopManifests, ...manifests]) {
      if (!new RegExp(`^id=${mod.modId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(info.text.replace(/\r/g, ''))) continue;
      const base = ['42', 'common'].includes(path.basename(info.root).toLowerCase()) ? path.dirname(info.root) : info.root;
      for (const relative of mod.jarPaths) locations.push({ file: path.join(base, relative), root: base });
    }
    for (const location of locations) { try { source = await safeJar(location.file); modRoot = location.root; break; } catch { } }
    mods.push({ ...mod, source, modRoot, status: source ? 'found' : 'missing' });
  }
  // Publicacoes novas podem ainda nao ter Workshop ID no catalogo. Busca limitada por mod.info.
  for (const lib of libraries) {
    const missing = mods.filter(mod => !mod.source && !settings.overrides?.[mod.id]);
    if (!missing.length) break;
    progress('Conferindo outros JARs da Workshop');
    const roots = await modRoots(path.join(lib, 'steamapps/workshop/content/108600'));
    for (const root of roots) {
      const info = await boundedRead(path.join(root, 'mod.info'), 65536).catch(() => '');
      for (const mod of missing) {
        if (mod.source || !new RegExp(`^id=${mod.modId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(info.replace(/\r/g, ''))) continue;
        const base = ['42', 'common'].includes(path.basename(root).toLowerCase()) ? path.dirname(root) : root;
        for (const relative of mod.jarPaths) {
          try { mod.source = await safeJar(path.join(base, relative)); mod.modRoot = base; mod.status = 'found'; break; } catch { }
        }
      }
      if (missing.every(mod => mod.source)) break;
    }
  }
  progress('Busca conclu\u00edda');
  return { gamePath, libraries, mods };
}

module.exports = { libraryPaths, steamPaths, validateGame, modRoots, discover };
