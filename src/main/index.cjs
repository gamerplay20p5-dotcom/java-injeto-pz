const { app, BrowserWindow, ipcMain, dialog, shell, protocol, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { validateCatalog } = require('./catalog.cjs');
const catalog = validateCatalog(require('../../catalog.json'));
const { Profiles, dependencies } = require('./profile.cjs');
const { discover } = require('./discovery.cjs');
const { inspectJar } = require('./jar.cjs');
const { within } = require('./files.cjs');
const { SteamAuth } = require('./steam-auth.cjs');

app.setName('Java Injeto - PZ');
if (!app.isPackaged && process.env.ORGANIC_TEST_DATA) app.setPath('userData', path.resolve(process.env.ORGANIC_TEST_DATA));
protocol.registerSchemesAsPrivileged([{ scheme: 'organic', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const origin = 'organic://launcher';
let window, profiles, settings, discovery, auth, currentJob = null, pendingLaunch = null, child = null;
let progress = '', lastExit = null;
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
  const ids = dependencies(settings.selected, catalog);
  const mods = (discovery?.mods || catalog.map(mod => ({ ...mod, source: null, status: 'missing' }))).map(mod => {
    const previous = prepared?.mods.find(item => item.id === mod.id);
    const isPrepared = previous && previous.hash === mod.hash && previous.source === mod.source;
    return { ...mod, selected: ids.includes(mod.id), automatic: ids.includes(mod.id) && !settings.selected.includes(mod.id),
      status: mod.error ? 'invalid' : !mod.source ? 'missing' : isPrepared ? 'ready' : previous ? 'changed' : 'found' };
  });
  return { version: app.getVersion(), settings, game: discovery?.gamePath ? { path: discovery.gamePath, java: path.join(discovery.gamePath, 'jre64/bin/java.exe') } : null,
    libraries: discovery?.libraries || [], mods, busy: currentJob, progress, auth: auth.state, history,
    runtimePath: path.join(app.getPath('userData'), 'runtime'), physicalMemoryGb: Math.round(os.totalmem() / 1024 ** 3),
    running: Boolean(child), lastExit, platform: process.platform, profileError };
}

async function emit() { if (window && !window.isDestroyed()) window.webContents.send('organic:state', await state()); }

async function exclusive(name, work) {
  if (currentJob) throw new Error('Aguarde a opera\u00e7\u00e3o atual terminar.');
  if (child && ['prepare', 'remove'].includes(name)) throw new Error('Feche o jogo antes de alterar os agentes.');
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
  pendingLaunch = null;
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
  window = new BrowserWindow({ width: 1240, height: 850, minWidth: 820, minHeight: 640, title: 'Java Injeto - PZ',
    backgroundColor: '#101413', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, '../preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(`${origin}/`)) event.preventDefault(); });
  window.on('close', () => auth.cancel());

  handler('getState', state);
  handler('scan', () => exclusive('scan', scan));
  handler('saveSettings', value => exclusive('settings', async () => { settings = await profiles.save(value); pendingLaunch = null; return scan(); }));
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
  handler('remove', () => exclusive('remove', async () => { await profiles.remove(); pendingLaunch = null; note('C\u00f3pias JAR removidas. Workshop e jogo preservados.', 'success'); }));
  handler('launchPlan', () => exclusive('review-launch', async () => {
    await scan();
    const plan = await profiles.launchPlan(settings, discovery);
    const token = crypto.randomUUID(); pendingLaunch = { token, plan, expires: Date.now() + 120000 };
    return { ...plan, token };
  }));
  handler('launch', token => exclusive('launch', async () => {
    if (process.platform !== 'win32') throw new Error('Este prot\u00f3tipo executa o cliente Windows.');
    if (child || !pendingLaunch || token !== pendingLaunch.token || Date.now() > pendingLaunch.expires) throw new Error('Revise a inicializa\u00e7\u00e3o novamente.');
    const expected = pendingLaunch.plan; pendingLaunch = null;
    const plan = await profiles.launchPlan(settings, discovery);
    if (JSON.stringify(plan) !== JSON.stringify(expected)) throw new Error('O plano mudou. Revise antes de iniciar.');
    const env = { ...process.env };
    delete env.JAVA_TOOL_OPTIONS; delete env.JDK_JAVA_OPTIONS; delete env._JAVA_OPTIONS;
    env.PATH = `${path.join(plan.cwd, 'jre64/bin')};${path.join(plan.cwd, 'win64')};${env.PATH || ''}`;
    // Sem shell: caminhos com espa\u00e7os n\u00e3o viram comandos. Sa\u00edda do jogo n\u00e3o \u00e9 coletada.
    const processChild = spawn(plan.executable, plan.args, { cwd: plan.cwd, env, shell: false, windowsHide: true, stdio: 'ignore' });
    child = processChild;
    await new Promise((resolve, reject) => {
      processChild.once('spawn', resolve);
      processChild.once('error', error => { child = null; reject(new Error(`N\u00e3o foi poss\u00edvel iniciar o Java: ${error.code || 'falha'}.`)); });
    });
    note('Processo Java iniciado. Abertura e compatibilidade no jogo ainda dependem dos mods.', 'success');
    processChild.once('exit', code => { if (child === processChild) child = null; lastExit = code; note(`O PZ encerrou com c\u00f3digo ${code}.`, code ? 'warning' : 'info'); void emit(); });
    return { pid: processChild.pid };
  }));
  handler('login', () => auth.start());
  handler('logout', () => auth.logout());
  handler('openWorkshop', async id => {
    const mod = catalog.find(item => item.id === id);
    if (!mod?.workshopId || !/^\d+$/.test(mod.workshopId)) throw new Error('Este mod ainda n\u00e3o tem link Workshop cadastrado.');
    await shell.openExternal(`https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.workshopId}`);
  });
  handler('openFolder', async key => {
    const targets = { game: discovery?.gamePath, runtime: app.getPath('userData') };
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
  void exclusive('scan', scan).catch(error => { note(error.message, 'error'); void emit(); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { window?.show(); window?.focus(); });
  app.whenReady().then(setup).catch(error => { dialog.showErrorBox('Java Injeto - PZ', error.message); app.quit(); });
  app.on('window-all-closed', () => { auth?.logout(); app.quit(); });
}
