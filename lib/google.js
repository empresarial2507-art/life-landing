// Acesso ao Google Sheets com a conta de serviço (GOOGLE_SA_JSON). Sem dependências.
const crypto = require('node:crypto');

const b64 = (s) => Buffer.from(s).toString('base64url');
let cache = null;

async function token() {
  if (cache && cache.exp > Date.now() + 60000) return cache.tk;
  const sa = JSON.parse(process.env.GOOGLE_SA_JSON);
  const t = Math.floor(Date.now() / 1000);
  const corpo = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(corpo).sign(sa.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: corpo + '.' + sig }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('token google: ' + JSON.stringify(j).slice(0, 200));
  cache = { tk: j.access_token, exp: Date.now() + 3500 * 1000 };
  return cache.tk;
}

async function sheets(planilha, caminho, opcoes = {}) {
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${planilha}${caminho}`, {
    ...opcoes, headers: { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error('sheets ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

module.exports = { sheets };
