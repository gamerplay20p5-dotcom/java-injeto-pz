const { _electron } = require('playwright');
const asar = require('@electron/asar');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { hash } = require('../src/main/files.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const release = path.join(root, 'release');
  const executable = path.join(release, 'win-unpacked/Java Injeto - PZ.exe');
  const archive = path.join(release, 'win-unpacked/resources/app.asar');
  const portable = path.join(release, 'Java-Injeto-PZ-0.1.0-Windows.exe');
  const files = asar.listPackage(archive).map(file => file.split(path.sep).join('/'));
  assert(!files.some(file => /\.(jar|class|lua|dll)$/i.test(file)), 'pacote do app nao inclui arquivos dos mods');
  for (const required of ['/src/main/index.cjs', '/src/preload.cjs', '/catalog.json', '/dist/index.html', '/LICENSE', '/docs/TERCEIROS_PTBR.md']) assert(files.includes(required));
  assert(asar.extractFile(archive, 'LICENSE').toString().startsWith('MIT License'), 'licenca propria acompanha o pacote');
  const packagedCatalog = JSON.parse(asar.extractFile(archive, 'catalog.json').toString());
  assert.equal(packagedCatalog.mods.length, 3);
  let app;
  try {
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ executablePath: executable, args: [], env, timeout: 30000 });
    const page = await app.firstWindow();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('heading', { name: 'Seu Java, no lugar certo.' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.status-pill.ok'));
    const state = await page.evaluate(() => window.organic.getState());
    assert(state.game?.path); assert.equal(state.mods.length, 3);
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    assert(preferences.contextIsolation && preferences.sandbox && !preferences.nodeIntegration);
    await page.screenshot({ path: path.join(root, 'test-results/empacotado.png'), fullPage: true });
    assert.deepEqual(errors, []);
    // Apenas leitura e abertura da janela: nao altera preferencias nem prepara/inicia Java.
  } finally { if (app) await app.close(); }
  const stats = await fs.stat(portable);
  assert(stats.size > 10 * 1024 * 1024);
  await fs.writeFile(path.join(release, 'SHA256SUMS.txt'), `${await hash(portable)}  ${path.basename(portable)}\n`);
  console.log(`PASS: pacote Windows (${Math.round(stats.size / 1024 / 1024)} MiB), janela/IPC reais, isolamento ativo e nenhum arquivo de mod embutido.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
