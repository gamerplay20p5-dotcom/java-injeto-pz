const { _electron } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const assert = require('node:assert/strict');
const { fixture } = require('./test-fixture.cjs');
const { within } = require('../src/main/files.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-ui-'));
  const results = path.join(root, 'test-results'); await fs.mkdir(results, { recursive: true });
  let app, page; const errors = [];
  try {
    const fake = await fixture(temp), env = { ...process.env, ORGANIC_TEST_DATA: fake.data }; delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ args: [root], env, timeout: 30000 }); page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('navigation').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 3 && !document.querySelector('.spin'));
    const state = await page.evaluate(() => window.organic.getState()); assert.equal(state.game.path, fake.game);
    assert.equal(await page.getByRole('navigation').getByRole('button').count(), 7);
    assert.equal(await page.evaluate(() => typeof window.organic.launch), 'undefined');
    for (const name of ['Skinwalker', 'Viewpoint']) { await page.getByRole('switch', { name: `Selecionar ${name}` }).click(); await page.waitForFunction(() => !document.querySelector('.spin')); }
    assert.equal(await page.getByRole('switch', { checked: true }).count(), 3);
    await page.getByRole('button', { name: 'Revisar JAR', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Revisar JAR' }); await review.waitFor();
    assert.equal(await review.locator('.review-file').count(), 3);
    await review.getByRole('checkbox').check(); await review.getByRole('button', { name: 'Preparar JARs' }).click();
    await page.waitForFunction(() => document.querySelectorAll('tbody .badge.green').length === 3);
    await page.getByRole('button', { name: 'Injetar agora', exact: true }).click();
    const inject = page.getByRole('dialog', { name: 'Confirmar injeção' }); await inject.waitFor();
    assert((await inject.textContent()).includes(fake.target));
    assert.equal(await fs.readFile(fake.target, 'utf8'), fake.original);
    await page.screenshot({ path: path.join(results, 'revisao.png'), fullPage: true });
    await inject.getByRole('checkbox').check(); await inject.getByRole('button', { name: 'Injetar agora', exact: true }).click();
    await page.locator('.success strong').getByText('Java posicionado com sucesso', { exact: true }).waitFor();
    const flags = JSON.parse(await fs.readFile(fake.target, 'utf8')).vmArgs.filter(arg => arg.startsWith('-javaagent:'));
    assert.equal(flags.length, 2); assert(flags[0].includes('SkinwalkerAgent.jar')); assert(flags[1].includes('ZombieBuddy.jar=policy=prompt'));
    await page.getByRole('button', { name: 'Copiar SHA-256' }).click();
    assert.match(await app.evaluate(({ clipboard }) => clipboard.readText()), /^[a-f0-9]{64}$/);
    await page.screenshot({ path: path.join(results, 'desktop.png'), fullPage: true });
    // Imagem publica usa somente caminhos ficticios, sem nome de usuario Windows.
    await page.evaluate(({ prefix }) => {
      for (const el of document.querySelectorAll('code')) if (el.textContent.includes(prefix)) el.textContent = el.textContent.replaceAll(prefix, 'C:\\Teste\\Java Injeto');
    }, { prefix: temp });
    await page.screenshot({ path: path.join(results, 'documentacao.png'), fullPage: true });
    await page.getByRole('button', { name: 'Backup', exact: true }).click();
    await page.getByRole('button', { name: 'Restaurar backup', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restaurar', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    assert.equal(await fs.readFile(fake.target, 'utf8'), fake.original);
    await page.getByRole('button', { name: 'Otimizador', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.hardware')?.textContent.includes('GB') && !document.querySelector('.spin'), { timeout: 30000 });
    assert((await page.evaluate(() => window.organic.getState())).hardware.ramGb > 0);
    await page.screenshot({ path: path.join(results, 'otimizador.png'), fullPage: true });
    await page.getByRole('button', { name: 'Selecionar aplicativos' }).click(); await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Restaurar padrão', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restaurar', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role=dialog]'));
    await page.getByRole('button', { name: 'Configurações', exact: true }).click();
    await page.getByRole('button', { name: 'Claro', exact: true }).click(); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.screenshot({ path: path.join(results, 'configuracoes.png'), fullPage: true });
    await page.getByRole('button', { name: 'Escuro', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.spin'));
    await page.getByRole('button', { name: 'Sobre', exact: true }).click(); await page.getByRole('button', { name: 'Entrar com Steam', exact: true }).click();
    await page.getByRole('dialog', { name: 'Entrar com Steam' }).waitFor(); assert.equal(await page.locator('input[type=password]').count(), 0); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Início', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(760, 580));
    await page.screenshot({ path: path.join(results, 'compacto.png'), fullPage: true });
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), 'sem overflow horizontal');
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setMinimumSize(320,480); win.setSize(375,780); });
    await page.screenshot({ path: path.join(results, 'estreito.png'), fullPage: true });
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), 'previa estreita sem overflow horizontal');
    assert.deepEqual(errors, []); assert.equal(await fs.readFile(fake.target, 'utf8'), fake.original);
    console.log('PASS: 7 abas, revisao de JARs, injecao e backup em instalacao descartavel, hardware C#, temas, clipboard e janelas compactas; nenhum jogo aberto.');
  } catch (error) {
    if (page && !page.isClosed()) { await page.screenshot({ path: path.join(results, 'falha.png'), fullPage: true }).catch(() => {}); console.error(await page.locator('.toast').allTextContents()); }
    throw error;
  } finally {
    if (app) await app.close(); assert(within(os.tmpdir(), temp) && path.basename(temp).startsWith('organic-ui-')); await fs.rm(temp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
