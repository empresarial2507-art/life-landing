// Registra cada visita e cada clique de compra da landing na planilha "Landing LIFE · acessos e cliques".
// Recebe o beacon do index.html (texto JSON). Sem dependências. Env: GOOGLE_SA_JSON, SHEET_ID.
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

const curto = (v, n = 120) => String(v == null ? '' : v).slice(0, n);
const EVENTOS = { visita: 'visita', clique: 'clique' };

function origem(d, ua) {
  if (d.us) return 'etiqueta: ' + curto(d.us, 40);
  if (d.fb) return 'anúncio (fbclid)';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV/i.test(ua)) return 'facebook';
  let host = '';
  try { host = d.ref ? new URL(d.ref).host : ''; } catch (e) { host = ''; }
  if (/instagram/i.test(host)) return 'instagram';
  if (/facebook|fb\.me/i.test(host)) return 'facebook';
  if (host && !/life-landing|github\.io/.test(host)) return host;
  return 'direto';
}

function aparelho(ua) {
  const so = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Mac OS/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : 'outro';
  return (/Mobi|iPhone|Android/i.test(ua) ? 'celular' : 'computador') + ' · ' + so;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const d = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const ev = EVENTOS[d.e];
    if (!ev) return res.status(400).end();
    const ua = String(req.headers['user-agent'] || '');
    if (/bot|crawler|spider|preview|facebookexternalhit|HeadlessChrome|vercel-screenshot/i.test(ua)) return res.status(204).end();
    const quando = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 19).replace('T', ' ');
    const linha = [quando, ev, curto(d.b, 40), curto(d.vid, 24), curto(d.sid, 24), origem(d, ua), curto(d.us, 60), curto(d.um, 60), curto(d.uc, 60), curto(d.ut, 60), curto(d.ref, 200), aparelho(ua), curto(d.url, 80)];
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.SHEET_ID}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (await token()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [linha] }),
    });
    if (!r.ok) throw new Error('sheets ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return res.status(204).end();
  } catch (e) {
    console.error(e);
    return res.status(500).end();
  }
};
