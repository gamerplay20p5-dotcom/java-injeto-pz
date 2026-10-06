const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const run = promisify(require('node:child_process').execFile);
const { Updater, newer, releaseInfo, response } = require('../src/main/updater.cjs');
const { within, hash } = require('../src/main/files.cjs');
const bytes = Buffer.alloc(10 * 1024 ** 2, 7); bytes.write('MZ');
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
function release() { return { draft: false, prerelease: false, tag_name: 'v0.3.1', assets: [{ name: 'Java-Injeto-PZ-0.3.1-Setup.exe', size: bytes.length,
  digest: `sha256:${sha}`, browser_download_url: 'https://github.com/gamerplay20p5-dotcom/java-injeto-pz/releases/download/v0.3.1/Java-Injeto-PZ-0.3.1-Setup.exe' }] }; }
async function setup(payload = bytes) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-update-'));
  const requests = [];
  const updater = new Updater(root, '0.3.0', () => {}, async (url, options) => {
    requests.push({ url, options });
    return url.includes('api.github.com') ? new Response(JSON.stringify(release())) : new Response(payload);
  });
  return { root, updater, requests, close: async () => { assert(within(os.tmpdir(), root)); await fs.rm(root, { recursive: true, force: true }); } };
}
test('versao usa comparacao numerica; nao permite downgrade nem pre-release', () => {
  assert(newer('0.10.0', '0.3.0')); assert(!newer('0.1.0', '0.3.0')); assert(!newer('0.3.0', '0.3.0'));
  assert.throws(() => newer('0.3.1-beta', '0.3.0')); assert.throws(() => releaseInfo({ ...release(), prerelease: true }, '0.3.0'));
  assert.equal(releaseInfo(release(), '0.3.1'), null);
});
test('release de outro repositorio, hash ausente, tamanhos invalidos e URL externa sao recusados', () => {
  for (const change of [{ browser_download_url: 'https://evil.test/a.exe' }, { digest: null }, { size: 1 }, { size: 1024 ** 3 }, { digest: 'sha256:fake' }]) {
    const data = release(); Object.assign(data.assets[0], change); assert.throws(() => releaseInfo(data, '0.3.0'));
  }
});
test('redirecionamento externo e downgrade HTTP sao bloqueados antes da requisicao', async () => {
  for (const location of ['https://evil.test/file', 'http://github.com/file', 'https://user:secret@github.com/file']) {
    let calls = 0;
    await assert.rejects(response('https://github.com/file', new AbortController().signal, async () => {
      calls++; return new Response(null, { status: 302, headers: { location } });
    }), /nao autorizado/); assert.equal(calls, 1);
  }
});
test('consulta nao baixa instalador nem envia dados de conta; download confere hash', async () => {
  const f = await setup(); try {
    assert.equal((await f.updater.check()).status, 'available'); assert.equal(f.requests.length, 1);
    assert(!JSON.stringify(f.requests).includes('Authorization'));
    assert.equal((await f.updater.download()).status, 'downloaded');
    assert.equal(await hash(f.updater.downloaded.file), sha);
    assert.equal(f.requests.length, 2);
  } finally { await f.close(); }
});
test('download corrompido ou grande demais nunca vira instalador executavel', async () => {
  for (const payload of [Buffer.from('MZ corrompido'), Buffer.alloc(bytes.length + 1), Buffer.alloc(bytes.length)]) {
    const f = await setup(payload); try {
      await f.updater.check(); await assert.rejects(f.updater.download());
      assert.equal(f.updater.downloaded, null);
      assert.deepEqual(await fs.readdir(f.updater.root), []);
    } finally { await f.close(); }
  }
});
test('confirmacao incorreta e adulteracao apos download bloqueiam handoff C#', async () => {
  const f = await setup(); try {
    await f.updater.check(); await f.updater.download();
    await assert.rejects(f.updater.stage('incorreto', __filename, process.pid), /Confirme/);
    await fs.appendFile(f.updater.downloaded.file, 'externo');
    await assert.rejects(f.updater.stage(f.updater.state.token, __filename, process.pid), /alterado/);
  } finally { await f.close(); }
});
test('auxiliar C# valida tarefa e bytes sem abrir instalador; recusa arquivo adulterado', async () => {
  const f = await setup(); try {
    await f.updater.check(); await f.updater.download();
    const helper = path.join(__dirname, '../native/bin/UpdateHelper.exe');
    const plan = await f.updater.stage(f.updater.state.token, helper, process.pid);
    await run(plan.staged, [plan.task, '--validate-only'], { windowsHide: true });
    await fs.appendFile(f.updater.downloaded.file, 'externo');
    await assert.rejects(run(plan.staged, [plan.task, '--validate-only'], { windowsHide: true }));
    const task = JSON.parse(await fs.readFile(plan.task)); task.file = 'C:\\Windows\\system32\\cmd.exe';
    await fs.writeFile(plan.task, JSON.stringify(task));
    await assert.rejects(run(plan.staged, [plan.task, '--validate-only'], { windowsHide: true }));
  } finally { await f.close(); }
});

test('cancelamento durante streaming remove parcial e nao habilita instalacao', async () => {
  const f = await setup(); try {
    await f.updater.check();
    f.updater.transport = async (_url, options) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 1024));
        options.signal.addEventListener('abort', () => controller.error(new DOMException('cancelled', 'AbortError')), { once: true });
      }
    }));
    f.updater.changed = () => { if (f.updater.state.status === 'downloading') f.updater.cancel(); };
    await assert.rejects(f.updater.download());
    assert.equal(f.updater.downloaded, null); assert.deepEqual(await fs.readdir(f.updater.root), []);
    assert.match(f.updater.state.error, /cancelado/);
  } finally { await f.close(); }
});

test('metadados excessivos e HTTP indisponivel falham sem download', async () => {
  const f = await setup(); try {
    f.updater.transport = async () => new Response(Buffer.alloc(1024 ** 2 + 1));
    await assert.rejects(f.updater.check(), /grandes demais/);
    f.updater.transport = async () => new Response(null, { status: 403 });
    await assert.rejects(f.updater.check(), /HTTP 403/);
    assert.equal(f.updater.release, null);
  } finally { await f.close(); }
});
