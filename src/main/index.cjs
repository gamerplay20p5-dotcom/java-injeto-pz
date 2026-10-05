const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session, clipboard, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');
const { validateCatalog } = require('./catalog.cjs');
const catalog = validateCatalog(require('../../catalog.json'));
const { Profiles, dependencies } = require('./profile.cjs');
const { discover } = require('./discovery.cjs');
const { inspectJar } = require('./jar.cjs');
const { within, exists } = require('./files.cjs');
const { SteamAuth } = require('./steam-auth.cjs');
const { Injection } = require('./injection.cjs');
const { NativeOptimizer, recommendedHeap } = require('./optimizer.cjs');

app.setName('Java Injeto - PZ');
if (!app.isPackaged && process.env.ORGANIC_TEST_DATA) app.setPath('userData', path.resolve(process.env.ORGANIC_TEST_DATA));
protocol.registerSchemesAsPrivileged([{ scheme: 'organic', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const origin = 'organic://launcher';
let window, profiles, settings, discovery, auth, injection, optimizer, hardware = null, currentJob = null;
let progress = '';
const history = [];

function note(message, type = 'info') {
  // Apenas eventos do launcher. N\u00e3o guardamos stdout/chat/VOIP/SteamID em logs de disco.
  history.unshift({ id: crypto.randomUUID(), time: new Date().toISOString(), message, type });
  history.length = Math.min(history.length, 60);
}

async function state() {
  let prepared = null, profileError = null;
  try { prepared = await profiles.manifest(); }
  catch (error) { profileError = error.message; }
  let injected = { status: 'none' };
  try { injected = await injection.status(); } catch (error) { injected = { status: 'error', error: error.message }; }
  const ids = dependencies(settings.selected, catalog);
  const mods = (discovery?.mods || catalog.map(mod => ({ ...mod, source: null, status: 'missing' }))).map(mod => {
    const previous = prepared?.mods.find(item => item.id === mod.id);
    const isPrepared = previous && previous.hash === mod.hash && previous.source === mod.source;
    return { ...mod, selected: ids.includes(mod.id), automatic: ids.includes(mod.id) && !settings.selected.includes(mod.id),
      installed: previous?.installed || null,
      status: mod.error ? 'invalid' : !mod.source ? 'missing' : isPrepared ? 'ready' : previous ? 'changed' : 'found' };
  });
  const workshopPaths = (discovery?.libraries || []).map(lib => path.join(lib, 'steamapps/workshop/content/108600'));
  let workshopPath = null;
  for (const candidate of workshopPaths) if (await exists(candidate)) { workshopPath = candidate; break; }
  return { version: app.getVersion(), settings, game: discovery?.gamePath ? { path: discovery.gamePath, java: path.join(discovery.gamePath, 'jre64/bin/java.exe') } : null,
    libraries: discovery?.libraries || [], workshopPath, mods, busy: currentJob, progress, auth: auth.state, history,
    runtimePath: path.join(app.getPath('userData'), 'runtime'), physicalMemoryGb: Math.round(os.totalmem() / 1024 ** 3),
    platform: process.platform, profileError, injection: injected, hardware,
    optimizer: await optimizer.status(), recommendedGb: recommendedHeap(hardware, settings.optimizer.profile) };
}

async function emit() { if (window && !window.isDestroyed()) window.webContents.send('organic:state', await state()); }

async function exclusive(name, work) {
  if (currentJob) throw new Error('Aguarde a opera\u00e7\u00e3o atual terminar.');
  currentJob = name; await emit();
  try { return await work(); }
  finally { currentJob = null; progress = ''; await emit(); }
}

async function scan() {
  discovery = await discover(settings, catalog, message => { progress = message; void emit(); });
  for (const mod of discovery.mods) {
    if (!mod.source) continue;
    try { Object.assign(mod, await inspectJar(mod.source, mod.kind === 'agent' ? mod.premain : null)); }
    catch (error) { mod.error = error.message; }
  }
  injection.preview = null;
  note(discovery.gamePath ? 'Cliente PZ localizado; busca de JARs conclu\u00edda.' : 'PZ n\u00e3o localizado. Selecione a pasta do jogo nas configura\u00e7\u00f5es.', discovery.gamePath ? 'success' : 'warning');
  return state();
}

function handler(name, work) {
  ipcMain.handle(`organic:${name}`, async (event, ...args) => {
    // Frames filhos e p\u00e1ginas externas n\u00e3o recebem acesso ao sistema de arquivos.
    const source = new URL(event.senderFrame?.url || 'about:blank');
    if (event.sender !== window?.webContents || event.senderFrame !== window.webContents.mainFrame
      || source.protocol !== 'organic:' || source.hostname !== 'launcher' || source.pathname !== '/index.html')
      return { ok: false, error: 'Origem de solicita\u00e7\u00e3o n\u00e3o autorizada.' };
    try { return { ok: true, data: await work(...args) }; }
    catch (error) { note(error.message || 'Opera\u00e7\u00e3o recusada.', 'error'); await emit(); return { ok: false, error: error.message || 'Opera\u00e7\u00e3o recusada.' }; }
  });
}

async function setup() {
  profiles = new Profiles(app.getPath('userData'), catalog);
  settings = await profiles.load();
  injection = new Injection(app.getPath('userData'));
  optimizer = new NativeOptimizer(app.isPackaged ? path.join(process.resourcesPath, 'native/OrganicHelper.exe') : path.join(app.getAppPath(), 'native/bin/OrganicHelper.exe'), app.getPath('userData'));
  auth = new SteamAuth(url => shell.openExternal(url), () => void emit());
  const dist = path.join(app.getAppPath(), 'dist');
  protocol.handle('organic', async request => {
    const url = new URL(request.url);
    const file = path.resolve(dist, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (url.hostname !== 'launcher' || !within(dist, file)) return new Response('Recusado', { status: 403 });
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
    try { return new Response(await fs.readFile(file), { headers: { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'" } }); }
    catch { return new Response('N\u00e3o encontrado', { status: 404 }); }
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const area = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(1050, area.width), height = Math.min(740, area.height);
  window = new BrowserWindow({ width, height, minWidth: Math.min(760, width), minHeight: Math.min(580, height), title: 'Java Injeto',
    icon: path.join(app.getAppPath(), 'assets/Logo_Organic.png'),
    backgroundColor: '#131416', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, '../preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${origin}/`)) event.preventDefault(); });
  window.on('close', () => auth.cancel());

  handler('getState', state);
  handler('scan', () => exclusive('scan', scan));
  handler('saveSettings', value => exclusive('settings', async () => {
    const previous = settings; settings = await profiles.save(value); injection.preview = null;
    const changed = ['gamePath', 'steamPath', 'modRoots', 'overrides'].some(key => JSON.stringify(previous[key]) !== JSON.stringify(settings[key]));
    return changed ? scan() : state();
  }));
  handler('chooseFolder', async kind => {
    if (!['game', 'steam', 'mods'].includes(kind)) throw new Error('Tipo de pasta desconhecido.');
    const result = await dialog.showOpenDialog(window, { title: 'Selecionar pasta', properties: ['openDirectory'] });
    if (result.canceled) return null;
    const value = { ...settings };
    if (kind === 'mods') value.modRoots = [...new Set([...value.modRoots, result.filePaths[0]])];
    else value[kind === 'game' ? 'gamePath' : 'steamPath'] = result.filePaths[0];
    return exclusive('settings', async () => { settings = await profiles.save(value); return scan(); });
  });
  handler('chooseJar', async id => {
    if (!catalog.some(mod => mod.id === id && mod.kind === 'agent')) throw new Error('Selecione a pasta do mod da Workshop, n\u00e3o um JAR isolado.');
    const result = await dialog.showOpenDialog(window, { title: 'Localizar JAR baixado', properties: ['openFile'], filters: [{ name: 'Agente Java', extensions: ['jar'] }] });
    if (result.canceled) return null;
    return exclusive('settings', async () => { settings = await profiles.save({ ...settings, overrides: { ...settings.overrides, [id]: result.filePaths[0] } }); return scan(); });
  });
  handler('review', () => exclusive('review', async () => { await scan(); return profiles.review(settings, discovery); }));
  handler('apply', token => exclusive('prepare', async () => {
    const result = await profiles.apply(token, settings); note(`${result.count} agente(s) JAR preparado(s). Arquivos do jogo preservados.`, 'success');
    return result;
  }));
  async function gameClosed(root = discovery?.gamePath) {
    if (!root) throw new Error('Selecione a instalacao do PZ.');
    if (await optimizer.running(root)) throw new Error('Feche o PZ antes de injetar ou restaurar arquivos.');
  }
  handler('remove', () => exclusive('remove', async () => {
    if (!['none', 'restored'].includes((await injection.status()).status)) throw new Error('Restaure o backup antes de remover os JARs referenciados pelo jogo.');
    await profiles.remove(); note('Copias JAR removidas. Workshop preservada.', 'success');
  }));
  handler('reviewInjection', () => exclusive('review-injection', async () => {
    await gameClosed();
    if (settings.optimizer.memoryAuto && !hardware) hardware = await optimizer.detect();
    const plan = await profiles.launchPlan(settings, discovery);
    const manifest = await profiles.manifest();
    const ids = dependencies(settings.selected, catalog);
    return injection.review(plan.cwd, ids.map(id => manifest.mods.find(mod => mod.id === id)), settings, hardware);
  }));
  handler('inject', token => exclusive('inject', async () => {
    await gameClosed(); await profiles.launchPlan(settings, discovery);
    const result = await injection.apply(token); note('Java posicionado com sucesso. JSON configurado e backup preservado.', 'success'); return result;
  }));
  handler('restore', () => exclusive('restore', async () => {
    const receipt = await injection.receipt(); await gameClosed(receipt?.gamePath);
    const result = await injection.restore(); note('Backup restaurado. O jogo nao foi iniciado.', 'success'); return result;
  }));
  handler('hardware', () => exclusive('hardware', async () => { hardware = await optimizer.detect(); return hardware; }));
  handler('startOptimizer', () => exclusive('optimizer', async () => {
    if (!discovery?.gamePath) throw new Error('Selecione o PZ antes de configurar a sessao.');
    const result = await optimizer.start(discovery.gamePath, settings.optimizer); note('Otimizador aguardando o jogo. Nenhum jogo sera aberto.', 'success'); return result;
  }));
  handler('stopOptimizer', () => exclusive('optimizer-stop', async () => { const result = await optimizer.stop(); note('Restauracao da sessao solicitada.', 'success'); return result; }));
  handler('backgroundProcesses', () => optimizer.processes());
  handler('closeBackground', value => optimizer.close(value));
  handler('copyText', value => {
    if (typeof value !== 'string' || value.length > 4096 || value.includes('\0')) throw new Error('Texto invalido.');
    clipboard.writeText(value); return true;
  });
  handler('createShortcut', async () => {
    if (!app.isPackaged) throw new Error('Crie o atalho usando o executavel empacotado.');
    const executable = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe');
    const link = path.join(app.getPath('desktop'), 'Java Injeto.lnk');
    const success = shell.writeShortcutLink(link, 'create', { target: executable, cwd: path.dirname(executable), icon: executable, iconIndex: 0, description: 'Java Injeto - Injector Utility' });
    if (!success) throw new Error('Windows nao conseguiu criar o atalho.');
    note('Atalho Java Injeto criado na area de trabalho.', 'success'); await emit(); return { path: link };
  });
  handler('login', () => auth.start());
  handler('logout', () => auth.logout());
  handler('openWorkshop', async id => {
    const mod = catalog.find(item => item.id === id);
    if (!mod?.workshopId || !/^\d+$/.test(mod.workshopId)) throw new Error('Este mod ainda n\u00e3o tem link Workshop cadastrado.');
    await shell.openExternal(`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshopId}`);
  });
  handler('openFolder', async key => {
    const targets = { game: discovery?.gamePath, runtime: app.getPath('userData'), workshop: (await state()).workshopPath || settings.modRoots[0], backups: path.join(app.getPath('userData'), 'backups'), executable: path.dirname(process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')) };
    for (const mod of discovery?.mods || []) if (mod.source) targets[mod.id] = path.dirname(mod.source);
    if (!targets[key]) throw new Error('Pasta n\u00e3o dispon\u00edvel.');
    const error = await shell.openPath(targets[key]); if (error) throw new Error('N\u00e3o foi poss\u00edvel abrir a pasta.');
  });
  handler('exportDiagnostics', async () => {
    const result = await dialog.showSaveDialog(window, { defaultPath: 'Java-Injeto-diagnostico.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (result.canceled) return;
    // Exporta somente mediante comando expl\u00edcito; caminhos podem conter o nome do usu\u00e1rio do Windows.
    await fs.writeFile(result.filePath, JSON.stringify({ version: app.getVersion(), platform: process.platform, gamePath: discovery?.gamePath,
      mods: (discovery?.mods || []).map(({ id, hash, source, error }) => ({ id, hash, source, error })), history }, null, 2));
  });
  await window.loadURL(`${origin}/index.html`);
  const refresh = setInterval(() => { if (window && !window.isDestroyed() && window.isVisible()) void emit(); }, 10000);
  refresh.unref();
  void exclusive('scan', scan).catch(error => { note(error.message, 'error'); void emit(); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(setup).catch(error => { dialog.showErrorBox('Java Injeto - PZ', error.message); app.quit(); });
  app.on('window-all-closed', () => { auth?.logout(); app.quit(); });
}
