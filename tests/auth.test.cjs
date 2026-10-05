const test = require('node:test');
const assert = require('node:assert/strict');
const { SteamAuth, verifyAssertion, authorizeUrl, ENDPOINT, NS } = require('../src/main/steam-auth.cjs');

const returnUrl = 'http://127.0.0.1:40000/steam/callback?state=teste';
function assertion(url = returnUrl) {
  return new URLSearchParams({ state: 'teste', 'openid.ns': NS, 'openid.mode': 'id_res', 'openid.op_endpoint': ENDPOINT,
    'openid.return_to': url, 'openid.claimed_id': 'https://steamcommunity.com/openid/id/76561198000000000',
    'openid.identity': 'https://steamcommunity.com/openid/id/76561198000000000',
    'openid.response_nonce': new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') + 'nonce',
    'openid.assoc_handle': 'steam-assoc', 'openid.signed': 'op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle', 'openid.sig': 'assinatura' });
}
const accept = async () => new Response(`ns:${NS}\nis_valid:true\n`);
test('URL leva ao domínio oficial, retorno loopback e sem pedido de perfil', () => {
  const url = new URL(authorizeUrl(returnUrl));
  assert.equal(url.origin, 'https://steamcommunity.com'); assert.equal(url.searchParams.get('openid.return_to'), returnUrl);
  assert.equal(url.searchParams.get('openid.realm'), 'http://127.0.0.1:40000/');
  assert(!url.href.includes('api_key')); assert(!url.href.includes('sreg'));
});
test('SteamID é aceito somente após check_authentication no endpoint fixo', async () => {
  const id = await verifyAssertion(assertion(), returnUrl, async (url, options) => {
    assert.equal(url, ENDPOINT); assert.equal(options.redirect, 'error'); assert.equal(options.body.get('openid.mode'), 'check_authentication');
    return accept();
  });
  assert.equal(id, '76561198000000000');
});
for (const [label, mutate] of [
  ['provedor falso', p => p.set('openid.op_endpoint', 'https://malicioso.example/')],
  ['retorno diferente', p => p.set('openid.return_to', 'http://127.0.0.1:40001/callback')],
  ['campo não assinado', p => p.set('openid.signed', 'identity')],
  ['SteamID falso', p => p.set('openid.claimed_id', 'https://malicioso.example/id/76561198000000000')],
  ['identidade divergente', p => p.set('openid.identity', 'http://steamcommunity.com/openid/id/76561198000000001')],
  ['nonce antigo', p => p.set('openid.response_nonce', '2000-01-01T00:00:00Zantigo')],
  ['parâmetro duplicado', p => p.append('openid.identity', 'duplicado')]
]) test(`OpenID rejeita ${label} antes de consultar a rede`, async () => {
  const p = assertion(); mutate(p);
  await assert.rejects(verifyAssertion(p, returnUrl, () => { throw new Error('Não deveria consultar a rede'); }));
});
test('assinatura negativa da Steam é recusada', async () => {
  await assert.rejects(verifyAssertion(assertion(), returnUrl, async () => new Response(`ns:${NS}\nis_valid:false`)));
});

test('resposta remota tem limite de bytes, sem carregar um corpo ilimitado', async () => {
  await assert.rejects(verifyAssertion(assertion(), returnUrl, async () => new Response('x'.repeat(8193))), /limite/);
});

test('SteamID individual aceita todo o intervalo de contas de 32 bits', async () => {
  const params = assertion(), id = 'https://steamcommunity.com/openid/id/76561202255233023';
  params.set('openid.identity', id); params.set('openid.claimed_id', id);
  assert.equal(await verifyAssertion(params, returnUrl, accept), '76561202255233023');
});
test('loopback exige estado da solicitação e encerra; identidade não é persistida', async () => {
  let authUrl, changes = [];
  const auth = new SteamAuth(async url => { authUrl = url; }, value => changes.push(value), accept);
  try {
    await auth.start();
    const callback = new URL(new URL(authUrl).searchParams.get('openid.return_to'));
    const bad = new URL(callback); bad.searchParams.set('state', 'outro');
    const rejected = await fetch(bad); assert.equal(rejected.status, 400);
    const params = assertion(callback.href); params.set('state', callback.searchParams.get('state'));
    callback.search = params.toString();
    const accepted = await fetch(callback); assert.equal(accepted.status, 200); await accepted.text();
    assert.equal(auth.state.steamId, '76561198000000000'); assert.equal(auth.server, null);
    auth.logout(); assert.deepEqual(auth.state, { status: 'offline' }); assert(changes.length >= 3);
  } finally { auth.cancel(); }
});
test('cancelamento do navegador limpa solicitação sem SteamID', async () => {
  let url; const auth = new SteamAuth(async value => { url = value; }, () => {}, accept);
  try {
    await auth.start(); const callback = new URL(new URL(url).searchParams.get('openid.return_to'));
    callback.searchParams.set('openid.mode', 'cancel');
    const result = await fetch(callback); assert.equal(result.status, 200); await result.text();
    assert.deepEqual(auth.state, { status: 'offline' }); assert.equal(auth.server, null);
  } finally { auth.cancel(); }
});
