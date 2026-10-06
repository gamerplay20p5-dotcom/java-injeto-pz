const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { hash, within, atomicJson } = require('./files.cjs');

const repository = 'gamerplay20p5-dotcom/java-injeto-pz';
const endpoint = `https://api.github.com/repos/${repository}/releases/latest`;
const maximum = 256 * 1024 ** 2;
function version(text) {
  if (typeof text !== 'string' || !/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(text)) throw new Error('Versao de atualizacao invalida.');
  return text.split('.').map(Number);
}
function newer(left, right) {
  const a = version(left), b = version(right);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function releaseInfo(data, current) {
  if (!data || data.draft !== false || data.prerelease !== false) throw new Error('Release publica estavel nao encontrada.');
  const next = data.tag_name?.replace(/^v/, '');
  if (!newer(next, current)) return null;
  const name = `Java-Injeto-PZ-${next}-Setup.exe`;
  const asset = data.assets?.find(item => item.name === name);
  const expected = `https://github.com/${repository}/releases/download/v${next}/${name}`;
  if (!asset || asset.browser_download_url !== expected || !Number.isSafeInteger(asset.size)
    || asset.size < 10 * 1024 ** 2 || asset.size > maximum || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || ''))
    throw new Error('Atualizacao sem instalador ou SHA-256 confiavel publicado pelo GitHub.');
  return { version: next, name, url: expected, hash: asset.digest.slice(7), size: asset.size };
}
async function response(url, signal, transport = fetch, metadata = false) {
  for (let redirect = 0; redirect < 5; redirect++) {
    const parsed = new URL(url);
    const hosts = metadata ? ['api.github.com'] : ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'];
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || !hosts.includes(parsed.hostname))
      throw new Error('Destino de atualizacao nao autorizado.');
    const result = await transport(url, { redirect: 'manual', signal,
      headers: { 'User-Agent': 'Java-Injeto-PZ', Accept: metadata ? 'application/vnd.github+json' : 'application/octet-stream' } });
    if ([301, 302, 303, 307, 308].includes(result.status)) {
      const location = result.headers.get('location');
      await result.body?.cancel();
      if (!location) throw new Error('Redirecionamento de download invalido.');
      url = new URL(location, url).href; continue;
    }
    if (!result.ok || !result.body) throw new Error(`GitHub indisponivel (HTTP ${result.status}). Tente novamente mais tarde.`);
    return result;
  }
  throw new Error('Redirecionamentos demais no download.');
}
class Updater {
  constructor(root, current, changed = () => {}, transport = fetch) {
    this.root = path.join(root, 'updates'); this.current = current; this.changed = changed; this.transport = transport;
    this.state = { status: 'idle', current }; this.release = null; this.controller = null; this.downloaded = null;
  }
  report(patch) { this.state = { ...this.state, ...patch }; this.changed(); }
  async directory() {
    await fs.mkdir(this.root, { recursive: true });
    if ((await fs.lstat(this.root)).isSymbolicLink() || !within(await fs.realpath(path.dirname(this.root)), await fs.realpath(this.root)))
      throw new Error('Pasta de atualizacoes insegura.');
  }
  async check() {
    if (this.controller) throw new Error('Uma atualizacao ja esta em andamento.');
    this.report({ status: 'checking', error: null });
    this.release = null; this.downloaded = null;
    this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 15000);
    try {
      const result = await response(endpoint, this.controller.signal, this.transport, true);
      const chunks = []; let size = 0;
      for await (const chunk of result.body) {
        size += chunk.length;
        if (size > 1024 ** 2) { this.controller.abort(); throw new Error('Metadados de release grandes demais.'); }
        chunks.push(chunk);
      }
      this.release = releaseInfo(JSON.parse(Buffer.concat(chunks).toString('utf8')), this.current);
      this.report({ status: this.release ? 'available' : 'current', release: this.release, received: 0 });
      return this.state;
    } catch (error) { this.report({ status: 'error', error: error.message, release: null }); throw error; }
    finally { clearTimeout(timeout); this.controller = null; }
  }
  cancel() { this.controller?.abort(); }
  async download() {
    if (!this.release || this.controller) throw new Error('Verifique as atualizacoes antes de baixar.');
    const release = this.release;
    this.controller = new AbortController();
    const timeout = setTimeout(() => this.controller?.abort(), 5 * 60000);
    let temporary;
    try {
      await this.directory();
      const file = path.join(this.root, `${release.hash}.exe`);
      if (await fs.lstat(file).then(stat => stat.isSymbolicLink(), error => error.code === 'ENOENT' ? false : Promise.reject(error)))
        throw new Error('Destino de atualizacao irregular.');
      temporary = `${file}.${crypto.randomUUID()}.partial`;
      const result = await response(release.url, this.controller.signal, this.transport);
      const stream = await fs.open(temporary, 'wx'), checksum = crypto.createHash('sha256'); let received = 0, last = 0;
      this.report({ status: 'downloading', release, received: 0, error: null });
      try {
        for await (const chunk of result.body) {
          received += chunk.length;
          if (received > release.size) { this.controller.abort(); throw new Error('Download excedeu o tamanho publicado.'); }
          checksum.update(chunk);
          // FileHandle.writeFile appends at the current position and handles partial writes.
          await stream.writeFile(chunk);
          if (Date.now() - last > 200) { this.report({ received }); last = Date.now(); }
        }
        await stream.sync();
      } finally { await stream.close(); }
      if (received !== release.size || checksum.digest('hex') !== release.hash) throw new Error('SHA-256 ou tamanho divergente. Atualizacao recusada.');
      const handle = await fs.open(temporary, 'r');
      try { const header = Buffer.alloc(2); await handle.read(header, 0, 2, 0); if (header.toString() !== 'MZ') throw new Error('Instalador Windows invalido.'); }
      finally { await handle.close(); }
      await fs.rename(temporary, file);
      this.downloaded = { file, token: crypto.randomUUID(), ...release };
      this.report({ status: 'downloaded', received, token: this.downloaded.token });
      return this.state;
    } catch (error) { this.report({ status: 'error', error: error.name === 'AbortError' ? 'Download cancelado ou tempo esgotado.' : error.message }); throw error; }
    finally { clearTimeout(timeout); this.controller = null; if (temporary) await fs.rm(temporary, { force: true }); }
  }
  async stage(token, helper, pid) {
    const item = this.downloaded;
    if (!item || token !== item.token || !newer(item.version, this.current)) throw new Error('Confirme uma atualizacao verificada.');
    await this.directory();
    const stat = await fs.lstat(item.file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== item.size || !within(await fs.realpath(this.root), await fs.realpath(item.file))
      || await hash(item.file) !== item.hash) throw new Error('Instalador alterado depois do download.');
    const helperHash = await hash(helper), staged = path.join(this.root, `${helperHash}.helper.exe`);
    try { await fs.copyFile(helper, staged, fs.constants.COPYFILE_EXCL); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    if ((await fs.lstat(staged)).isSymbolicLink() || await hash(staged) !== helperHash) throw new Error('Auxiliar de atualizacao adulterado.');
    const task = path.join(this.root, `${crypto.randomUUID()}.task.json`);
    await atomicJson(task, { file: item.file, hash: item.hash, size: item.size, pid, createdAt: Date.now() });
    return { staged, task };
  }
  async install(token, helper, pid) {
    const plan = await this.stage(token, helper, pid);
    const child = spawn(plan.staged, [plan.task], { windowsHide: true, detached: true, stdio: 'ignore', shell: false });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    child.unref(); this.downloaded = null;
    this.report({ status: 'installing', token: null });
  }
}
module.exports = { Updater, version, newer, releaseInfo, response };
