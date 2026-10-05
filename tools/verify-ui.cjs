const { _electron } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-ui-'));
  const results = path.join(root, 'test-results');
  await fs.mkdir(results, { recursive: true });
  let app, page;
  const errors = [];
  try {
    const env = { ...process.env, ORGANIC_TEST_DATA: temp };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({ args: [root], env, timeout: 30000 });
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('heading', { name: 'Seu Java, no lugar certo.' }).waitFor();
    await page.waitForFunction(() => document.querySelector('.status-pill.ok'), { timeout: 30000 });
    const state = await page.evaluate(() => window.organic.getState());
    assert(state.game?.path, 'jogo detectado');
    assert(state.mods.some(mod => mod.id === 'skinwalker' && mod.source), 'JAR local detectado');
    await page.screenshot({ path: path.join(results, 'desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Detalhes de Viewpoint' }).click();
    await page.getByRole('dialog').waitFor();
    await page.screenshot({ path: path.join(results, 'detalhes.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Configurações', exact: true }).click();
    await page.getByRole('button', { name: 'Claro', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.screenshot({ path: path.join(results, 'configuracoes.png'), fullPage: true });
    await page.getByRole('button', { name: 'Privacidade', exact: true }).click();
    await page.getByRole('heading', { name: 'Privacidade e Steam' }).waitFor();
    await page.getByRole('button', { name: 'Entrar com Steam', exact: true }).first().click();
    await page.getByRole('dialog', { name: 'Entrar com Steam' }).waitFor();
    assert.equal(await page.locator('input[type=password]').count(), 0, 'não existe campo de senha');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Biblioteca Java', exact: true }).click();
    await page.getByRole('switch', { name: 'Preparar Java de Viewpoint' }).click();
    await page.waitForFunction(() => document.querySelectorAll('[role=switch][aria-checked=true]').length === 2);
    await page.getByRole('switch', { name: 'Preparar Java de Skinwalker' }).click();
    await page.waitForFunction(() => document.querySelectorAll('[role=switch][aria-checked=true]').length === 3);
    await page.getByRole('button', { name: 'Revisar e preparar' }).click();
    const review = page.getByRole('dialog', { name: 'Revisar agentes Java' });
    await review.waitFor();
    await review.locator('.review-file strong').filter({ hasText: 'ZombieBuddy' }).waitFor();
    await review.getByRole('checkbox').check();
    await review.getByRole('button', { name: 'Preparar JARs aprovados' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.badge.green').length === 3);
    await page.getByRole('button', { name: 'Iniciar PZ', exact: true }).click();
    await page.getByRole('dialog', { name: 'Revisar inicialização' }).waitFor();
    const args = (await page.locator('.arguments pre').textContent()).split('\n').filter(line => line.startsWith('-javaagent:'));
    assert.equal(args.length, 2); assert(args[0].includes('SkinwalkerAgent.jar')); assert(args[1].includes('ZombieBuddy.jar'));
    await page.screenshot({ path: path.join(results, 'revisao.png'), fullPage: true });
    await page.keyboard.press('Escape'); // NUNCA inicia jogo ou abre login real neste teste.
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(840, 680));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(results, 'compacto.png'), fullPage: true });
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), 'sem overflow horizontal');
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setMinimumSize(320, 480); window.setSize(375, 780);
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(results, 'estreito.png'), fullPage: true });
    assert(!await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), 'previa estreita sem overflow horizontal');
    assert.deepEqual(errors, []);
    console.log('PASS: Electron real, preload/IPC, busca local, modais, temas, dependências, preparação JAR e revisão sem executar o jogo.');
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(results, 'falha.png'), fullPage: true }).catch(() => {});
      console.error(await page.locator('.toast').allTextContents());
    }
    throw error;
  } finally {
    if (app) await app.close();
    assert(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
