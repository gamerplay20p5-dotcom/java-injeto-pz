const { _electron } = require('playwright');
const asar = require('@electron/asar');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { within } = require('../src/main/files.cjs');
const { fixture } = require('./test-fixture.cjs');
const { checksums } = require('./publish-local-artifacts.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const args = process.argv.slice(2);
  const release = path.resolve(root, args.find(arg => !arg.startsWith('--')) || 'release');
  const archive = path.join(release, 'win-unpacked/resources/app.asar');
  const portable = path.join(release, `Java-Injeto-PZ-${require('../package.json').version}-Windows.exe`);
  const executable = path.join(release, 'win-unpacked/Java Injeto - PZ.exe');
  const files = asar.listPackage(archive).map(file => file.split(path.sep).join('/'));
  assert(!files.some(file => /\.(jar|class|lua|dll)$/i.test(file)), 'pacote do app nao inclui arquivos dos mods');
  for (const required of ['/src/main/index.cjs', '/src/preload.cjs', '/catalog.json', '/dist/index.html', '/LICENSE', '/docs/TERCEIROS_PTBR.md', '/assets/app.ico', '/assets/Logo_Organic.png']) assert(files.includes(required));
  assert((await fs.stat(path.join(release, 'win-unpacked/resources/native/OrganicHelper.exe'))).size > 4096);
  assert(asar.extractFile(archive, 'LICENSE').toString().startsWith('MIT License'), 'licenca propria acompanha o pacote');
  const packagedCatalog = JSON.parse(asar.extractFile(archive, 'catalog.json').toString());
  assert.equal(packagedCatalog.mods.length, 3);
  await fs.mkdir(path.join(root, 'test-results'), { recursive: true });
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-package-'));
  let app;
  try {
    const fake = await fixture(temp);
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    // Perfil separado evita disputar a instancia ou ler preferencias reais.
    app = await _electron.launch({ executablePath: executable, args: [`--user-data-dir=${fake.data}`], env, timeout: 30000 });
    assert.equal(path.resolve(await app.evaluate(({ app }) => app.getPath('userData'))), path.resolve(fake.data));
    const page = await app.firstWindow();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('navigation').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3 && !document.querySelector('.spin'));
    const state = await page.evaluate(() => window.organic.getState());
    assert.equal(state.game.path, fake.game); assert.equal(state.mods.length, 3);
    assert.equal(await page.evaluate(() => typeof window.organic.launch), 'undefined');
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert(preferences.contextIsolation && preferences.sandbox && !preferences.nodeIntegration);
    await page.screenshot({ path: path.join(root, 'test-results/empacotado.png'), fullPage: true });
    await page.getByRole('button', { name: 'Otimizador', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.hardware')?.textContent.includes('GB') && !document.querySelector('.spin'), { timeout: 30000 });
    assert.deepEqual(errors, []);
    assert.equal(await fs.readFile(fake.target, 'utf8'), fake.original);
    // Apenas leitura e abertura da janela: nao altera preferencias nem prepara/inicia Java.
  } finally {
    try { if (app) await app.close(); }
    finally {
      assert(within(os.tmpdir(), temp) && path.basename(temp).startsWith('organic-package-'));
      await fs.rm(temp, { recursive: true, force: true });
    }
  }
  const stats = await fs.stat(portable);
  assert(stats.size > 10 * 1024 * 1024);
  await checksums(release);
  console.log(`PASS: pacote Windows (${Math.round(stats.size / 1024 / 1024)} MiB), janela/IPC reais, isolamento ativo e nenhum arquivo de mod embutido.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
