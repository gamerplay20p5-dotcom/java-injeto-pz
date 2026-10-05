const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { NativeOptimizer } = require('../src/main/optimizer.cjs');
const { within } = require('../src/main/files.cjs');
const run = promisify(execFile), root = path.resolve(__dirname, '..');
const compiler = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
const windows = { skip: process.platform !== 'win32', timeout: 30000 };
async function fixture() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'organic-native-'));
  return { directory, cleanup: async () => { assert(within(os.tmpdir(), directory) && path.basename(directory).startsWith('organic-native-')); await fs.rm(directory, { recursive: true, force: true }); } };
}
test('energia C#: original, escolha manual, falha parcial e adulteracao', windows, async () => {
  const f = await fixture(); try {
    const binary = path.join(f.directory, 'NativeRegression.exe');
    await run(compiler, ['/nologo', '/target:exe', '/r:System.Web.Extensions.dll', '/r:System.Core.dll', `/out:${binary}`, path.join(root, 'native/PowerSession.cs'), path.join(root, 'tests/NativeRegression.cs')], { windowsHide: true });
    const result = await run(binary, [path.join(f.directory, 'optimizer')], { windowsHide: true }); assert(result.stdout.includes('4 cenarios'));
  } finally { await f.cleanup(); }
});
test('monitor C# aguarda sem abrir jogo, rejeita duplicacao e restaura ao parar', windows, async () => {
  const f = await fixture(); let service, childPid;
  try {
    const binary = path.join(f.directory, 'OrganicHelper.exe');
    await run(compiler, ['/nologo', '/target:exe', '/platform:x64', '/r:System.Management.dll', '/r:System.Web.Extensions.dll', '/r:System.Core.dll', `/out:${binary}`, path.join(root, 'native/OrganicHelper.cs'), path.join(root, 'native/PowerSession.cs')], { windowsHide: true });
    const game = path.join(f.directory, 'Jogo vazio'); await fs.mkdir(game); await fs.writeFile(path.join(game, 'ProjectZomboid64.json'), '{}');
    service = new NativeOptimizer(binary, f.directory);
    assert.equal(await service.running(game), false);
    const value = await service.start(game, { monitor: true, power: false, priority: false }); childPid = value.pid;
    assert.equal(value.status, 'watching'); assert(value.pid > 0);
    assert(value.helperMb > 0); console.log(`Auxiliar C# aguardando: ${value.helperMb} MiB de working set nesta maquina.`);
    await assert.rejects(service.start(game, { monitor: true }), /ativo/);
    assert.equal(await service.running(game), false);
    await service.stop();
    for (let attempt = 0; attempt < 50 && (await service.status()).status !== 'idle'; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal((await service.status()).status, 'idle');
    // O auxiliar finaliza sozinho apos restaurar; nao depende da vida do Electron.
    for (let attempt = 0; attempt < 30; attempt++) {
      try { process.kill(childPid, 0); } catch { childPid = null; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(childPid, null, 'processo auxiliar encerrado');
  } finally { if (service && childPid) await service.stop(); await f.cleanup(); }
});
test('monitor nao aceita timestamp invalido como sessao saudavel', async () => {
  const f = await fixture(); try {
    const service = new NativeOptimizer('nao executa', f.directory); await fs.mkdir(service.root);
    await fs.writeFile(path.join(service.root, 'status.json'), '{"status":"active","updatedAt":"invalido"}');
    assert.equal((await service.status()).status, 'warning');
  } finally { await f.cleanup(); }
});
