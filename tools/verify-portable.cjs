const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { fixture } = require('./test-fixture.cjs');
const { within } = require('../src/main/files.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-portable-'));
  const fake = await fixture(temp); let child, browser;
  try {
    const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    // O wrapper portatil nao oferece o pipe Node esperado por _electron.launch.
    const executable = path.join(root, 'release', `Java-Injeto-PZ-${require('../package.json').version}-Windows.exe`);
    child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${fake.data}`], { env, windowsHide: true, shell: false, stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    let endpoint;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { const value = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) }); endpoint = (await value.json()).webSocketDebuggerUrl; if (endpoint) break; } catch { }
      if (child.exitCode != null) throw new Error(`Portatil encerrou antes de abrir: ${child.exitCode}`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(endpoint, 'portatil abriu endpoint local de teste');
    browser = await chromium.connectOverCDP(endpoint);
    const page = browser.contexts()[0].pages()[0]; await page.getByRole('navigation').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3 && !document.querySelector('.spin'));
    const state = await page.evaluate(() => window.organic.getState());
    assert.equal(state.game.path, fake.game); assert.equal(state.version, require('../package.json').version);
    assert.equal(await page.evaluate(() => typeof window.organic.launch), 'undefined');
    await page.getByRole('button', { name: 'Otimizador', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.hardware')?.textContent.includes('GB') && !document.querySelector('.spin'), { timeout: 30000 });
    assert((await page.evaluate(() => window.organic.getState())).hardware.ramGb > 0);
    assert.equal(await fs.readFile(fake.target, 'utf8'), fake.original);
    await page.screenshot({ path: path.join(root, 'test-results/portatil.png'), fullPage: true });
    await page.evaluate(() => window.close()); await browser.close(); browser = null;
    for (let attempt = 0; attempt < 100 && child.exitCode == null; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(child.exitCode, 0, 'wrapper e app encerraram sem erro'); child = null;
    console.log('PASS: Java Injeto.exe real abriu interface e auxiliar C#, usou perfil isolado e encerrou sem abrir o PZ.');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (child && child.exitCode == null) child.kill();
    assert(within(os.tmpdir(), temp) && path.basename(temp).startsWith('organic-portable-')); await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
