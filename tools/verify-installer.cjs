const { build, Platform, Arch } = require('electron-builder');
const { _electron } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { within, hash } = require('../src/main/files.cjs');
const { fixture } = require('./test-fixture.cjs');
const pkg = require('../package.json');
const root = path.resolve(__dirname, '..');

function run(executable, args) {
  return new Promise((resolve, reject) => {
    // /D e _? sao os ultimos argumentos NSIS; nao recebem aspas extras.
    const child = spawn(executable, args, { windowsHide: true, windowsVerbatimArguments: true, shell: false, stdio: 'ignore' });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Tempo excedido no instalador de teste.')); }, 120000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); resolve(code); });
  });
}

async function optionalHash(file) {
  try { return await hash(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function main() {
  assert.equal(process.platform, 'win32');
  assert.equal(pkg.build.nsis.deleteAppDataOnUninstall, false);
  const guid = randomUUID();
  const productName = `Java Injeto Installer Test ${guid.slice(0, 8)}`;
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-installer-'));
  const installed = path.join(temp, productName);
  const roaming = process.env.APPDATA;
  assert(roaming);
  const data = path.join(roaming, productName);
  assert(within(roaming, data) && path.basename(data) === productName);
  // Identidade e atalhos isolados evitam afetar uma instalacao de verdade.
  const protectedFiles = [path.join(os.homedir(), 'Desktop', 'Java Injeto.lnk'),
    ...['settings.json', 'prepared.json', 'injection.json'].map(name => path.join(roaming, pkg.build.productName, name))];
  const originalHashes = await Promise.all(protectedFiles.map(optionalHash));
  let app, uninstaller;
  try {
    const output = path.join(temp, 'build');
    await build({ targets: Platform.WINDOWS.createTarget(['nsis'], Arch.x64),
      prepackaged: path.join(root, 'release', 'win-unpacked'),
      config: { ...pkg.build, appId: `br.organic.javainjeto.installer-test.${guid}`, productName,
        directories: { output }, nsis: { ...pkg.build.nsis, guid, artifactName: 'Installer-Test.exe',
          shortcutName: productName, createDesktopShortcut: false, createStartMenuShortcut: false } } });
    const setup = path.join(output, 'Installer-Test.exe');
    assert.equal(await run(setup, ['/S', '/currentuser', `/D=${installed}`]), 0);
    uninstaller = path.join(installed, `Uninstall ${productName}.exe`);
    await fs.access(uninstaller);
    const executable = path.join(installed, `${productName}.exe`);
    // O nome do exe vem do pacote precompilado, nao do NSIS de teste.
    const actualExe = await fs.access(executable).then(() => executable, () => path.join(installed, `${pkg.build.productName}.exe`));
    await fs.access(actualExe);
    await fs.mkdir(path.join(data, 'backups'), { recursive: true });
    await fs.mkdir(path.join(data, 'runtime'), { recursive: true });
    const sentinels = ['settings.json', 'backups/original.json', 'runtime/agent-test.jar'];
    for (const name of sentinels) await fs.writeFile(path.join(data, name), `preservar-${name}`);
    const fake = await fixture(temp);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ executablePath: actualExe, args: [`--user-data-dir=${fake.data}`], env, timeout: 30000 });
    const page = await app.firstWindow();
    await page.getByRole('navigation').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3 && !document.querySelector('.spin'));
    assert.equal((await page.evaluate(() => window.organic.getState())).version, pkg.version);
    assert.equal(await page.evaluate(() => typeof window.organic.launch), 'undefined');
    assert.equal(await fs.readFile(fake.target, 'utf8'), fake.original);
    await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/instalado.png') });
    await app.close(); app = null;
    assert.equal(await run(setup, ['/S', '/currentuser', `/D=${installed}`]), 0, 'reinstalacao/atualizacao');
    assert.equal(await run(uninstaller, ['/S', '--delete-app-data', `_?=${installed}`]), 2, 'exclusao perigosa bloqueada');
    await fs.access(path.join(installed, 'resources', 'app.asar'));
    assert.equal(await run(uninstaller, ['/S', '/currentuser', `_?=${installed}`]), 0, 'desinstalacao');
    uninstaller = null;
    await assert.rejects(fs.access(path.join(installed, 'resources', 'app.asar')), { code: 'ENOENT' });
    for (const name of sentinels) assert.equal(await fs.readFile(path.join(data, name), 'utf8'), `preservar-${name}`);
    assert.deepEqual(await Promise.all(protectedFiles.map(optionalHash)), originalHashes);
    console.log('PASS: instalacao, app real, atualizacao e desinstalacao NSIS; backups/runtime preservados; dados e atalhos reais intactos.');
  } finally {
    if (app) await app.close();
    if (uninstaller && await optionalHash(uninstaller)) {
      assert(within(temp, uninstaller));
      assert.equal(await run(uninstaller, ['/S', '/currentuser', `_?=${installed}`]), 0, 'limpeza da instalacao de teste');
    }
    assert(within(roaming, data) && path.basename(data) === productName);
    await fs.rm(data, { recursive: true, force: true });
    assert(within(os.tmpdir(), temp) && path.basename(temp).startsWith('organic-installer-'));
    await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
