const http = require('node:http');
const crypto = require('node:crypto');
const ENDPOINT = 'https://steamcommunity.com/openid/login';
const NS = 'http://specs.openid.net/auth/2.0';

async function smallResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Resposta Steam vazia.');
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks).toString('utf8');
      length += value.length;
      if (length > 8192) throw new Error('Resposta Steam maior que o limite.');
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function authorizeUrl(returnUrl) {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({ 'openid.ns': NS, 'openid.mode': 'checkid_setup',
    'openid.return_to': returnUrl, 'openid.realm': new URL(returnUrl).origin + '/',
    'openid.identity': `${NS}/identifier_select`, 'openid.claimed_id': `${NS}/identifier_select` }).toString();
  return url.href;
}

async function verifyAssertion(params, returnUrl, fetcher = fetch, now = Date.now()) {
  for (const key of params.keys()) if (params.getAll(key).length !== 1) throw new Error('Resposta duplicada recusada.');
  if (params.get('openid.mode') !== 'id_res' || params.get('openid.ns') !== NS || params.get('openid.op_endpoint') !== ENDPOINT
      || params.get('openid.return_to') !== returnUrl) throw new Error('Resposta Steam n\u00e3o corresponde a esta solicita\u00e7\u00e3o.');
  const id = params.get('openid.claimed_id');
  const match = id?.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/);
  const base = 76561197960265728n;
  if (!match || BigInt(match[1]) <= base || BigInt(match[1]) > base + 0xffffffffn || params.get('openid.identity') !== id) throw new Error('Identidade Steam inv\u00e1lida.');
  const signed = new Set((params.get('openid.signed') || '').split(','));
  for (const key of ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle']) if (!signed.has(key)) throw new Error('Resposta sem campos assinados obrigat\u00f3rios.');
  const nonce = params.get('openid.response_nonce') || '';
  const timestamp = Date.parse(nonce.slice(0, 20));
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ.+$/.test(nonce) || !Number.isFinite(timestamp) || Math.abs(now - timestamp) > 5 * 60 * 1000)
    throw new Error('Resposta Steam antiga ou inv\u00e1lida.');
  const body = new URLSearchParams();
  for (const [key, value] of params) if (key.startsWith('openid.')) body.set(key, value);
  body.set('openid.mode', 'check_authentication');
  // Endpoint fixo e redirects proibidos: o retorno do navegador nunca escolhe o servidor consultado.
  const response = await fetcher(ENDPOINT, { method: 'POST', body, redirect: 'error', signal: AbortSignal.timeout(10000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!response.ok) throw new Error('A Steam n\u00e3o confirmou o login.');
  const text = await smallResponse(response);
  if (!/^is_valid:true\r?$/m.test(text) || !text.includes(`ns:${NS}`)) throw new Error('Assinatura Steam recusada.');
  return match[1];
}

class SteamAuth {
  constructor(openBrowser, onChange, fetcher = fetch) { this.openBrowser = openBrowser; this.onChange = onChange; this.fetcher = fetcher; this.state = { status: 'offline' }; }
  cancel() {
    clearTimeout(this.timer);
    this.server?.close(); this.server?.closeIdleConnections(); this.server = null;
    this.attempt = null;
  }
  logout() { this.cancel(); this.state = { status: 'offline' }; this.onChange(this.state); }
  async start() {
    this.cancel();
    const state = crypto.randomBytes(32).toString('hex'), attempt = crypto.randomUUID();
    this.attempt = attempt;
    let returnUrl, busy = false;
    const server = http.createServer(async (req, res) => {
      const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff' };
      const reply = (code, text) => { res.writeHead(code, headers); res.end(`<!doctype html><html lang="pt-BR"><title>Java Injeto - PZ</title><body style="background:#121514;color:#eee;font:18px system-ui;padding:48px"><h1>Java Injeto - PZ</h1><p>${text}</p><p>Voc\u00ea pode fechar esta aba e voltar ao launcher.</p></body></html>`); };
      try {
        if (req.method !== 'GET' || req.url.length > 16384 || req.headers.host !== new URL(returnUrl).host) { reply(400, 'Retorno inv\u00e1lido.'); return; }
        const url = new URL(req.url, new URL(returnUrl).origin);
        if (url.pathname !== '/steam/callback' || url.searchParams.get('state') !== state || busy || this.attempt !== attempt) { reply(400, 'Esta solicita\u00e7\u00e3o n\u00e3o est\u00e1 ativa.'); return; }
        if (url.searchParams.get('openid.mode') === 'cancel') { reply(200, 'Login cancelado.'); this.logout(); return; }
        busy = true;
        const steamId = await verifyAssertion(url.searchParams, returnUrl, this.fetcher);
        if (this.attempt !== attempt) { reply(400, 'Solicita\u00e7\u00e3o expirada.'); return; }
        this.state = { status: 'connected', steamId };
        reply(200, 'Identidade confirmada pela Steam. Nenhuma senha foi recebida pelo launcher.');
        this.cancel(); this.onChange(this.state);
      } catch { reply(400, 'N\u00e3o foi poss\u00edvel validar o retorno da Steam. Tente novamente no launcher.'); busy = false; }
    });
    server.maxHeadersCount = 30;
    server.maxConnections = 8;
    server.requestTimeout = 12000; server.headersTimeout = 12000;
    this.server = server;
    try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }); }
    catch { this.logout(); throw new Error('N\u00e3o foi poss\u00edvel abrir o retorno local do login.'); }
    returnUrl = `http://127.0.0.1:${server.address().port}/steam/callback?state=${state}`;
    this.state = { status: 'pending' }; this.onChange(this.state);
    this.timer = setTimeout(() => { if (this.attempt === attempt) { this.cancel(); this.state = { status: 'expired' }; this.onChange(this.state); } }, 5 * 60 * 1000);
    this.timer.unref();
    try { await this.openBrowser(authorizeUrl(returnUrl)); }
    catch { this.logout(); throw new Error('N\u00e3o foi poss\u00edvel abrir o navegador.'); }
    return this.state;
  }
}

module.exports = { SteamAuth, verifyAssertion, authorizeUrl, ENDPOINT, NS };
