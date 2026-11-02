// Listas do time na planilha "LIFE · Bônus Pix e boas-vindas (Black Friday)", atualizadas a cada 30 min
// (GitHub Actions chama este endpoint com a chave LISTAS_SECRET).
//   Aba "Bônus Pix": todo Anual em Dobro pago à vista no Pix desde 01/11. O time soma 3 meses no acesso da Cativa.
//   Aba "Boas-vindas": toda compra feita pela landing (bio ou cópia X do anúncio). O time chama no WhatsApp.
// Env: EDUZZ_API_KEY, GOOGLE_SA_JSON, LISTAS_SHEET_ID, LISTAS_SECRET.
const { sheets } = require('../lib/google');

const INICIO_BONUS = '2026-11-01';
const INICIO_BOAS_VINDAS = '2026-11-02';
const DOBRO = { 2562423: 'Anual em Dobro', 2569758: 'Anual em Dobro' };
const NOMES = {
  2562423: 'Anual em Dobro', 2569758: 'Anual em Dobro', 2457308: 'Anual mês a mês', 2375246: 'Anual mês a mês',
  2457307: 'Mensal', 2681901: 'Mensal', 2457306: 'Anual', 2681924: 'Anual',
};
const PAGAMENTO = { pix: 'Pix', creditCard: 'Cartão', bankslip: 'Boleto' };
const ABAS = {
  bonus: { nome: 'Bônus Pix', cab: ['Pago em', 'Nome', 'E-mail', 'WhatsApp', 'Fatura', 'Produto', 'Valor', 'Acesso sem bônus até', 'Acesso com bônus até', 'Feito?', 'Quem fez'], fatura: 4, check: 9 },
  boas: { nome: 'Boas-vindas', cab: ['Pago em', 'Nome', 'Chamar no WhatsApp', 'Telefone', 'Plano', 'Pagamento', 'Página', 'Fatura', 'Chamou?', 'Quem chamou', 'Observação'], fatura: 7, check: 8 },
};

const ID = () => process.env.LISTAS_SHEET_ID;
const dia = (d) => d.toISOString().slice(0, 10);
// A Eduzz manda o horário de Brasília com "Z" no fim: a parte da data e da hora já é a de Brasília.
const quando = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}`;
function somaMeses(s, meses) {
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1 + meses, +s.slice(8, 10)));
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}
const digitos = (t) => String(t || '').replace(/\D/g, '');
const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';

async function eduzz(caminho, q = {}) {
  const u = new URL('https://api.eduzz.com' + caminho);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { authorization: 'Bearer ' + process.env.EDUZZ_API_KEY, accept: 'application/json' } });
  if (!r.ok) throw new Error(`eduzz ${r.status} ${caminho}`);
  return r.json();
}

async function vendasPagas(desde) {
  const fim = dia(new Date(Date.now() - 3 * 3600e3));
  let itens = [];
  for (let pg = 1; pg <= 20; pg++) {
    const d = await eduzz('/myeduzz/v1/sales', { startDate: desde, endDate: fim, referenceDate: 'paidAt', status: 'paid', itemsPerPage: '100', page: String(pg) });
    itens = itens.concat(d.items || []);
    if (pg >= (d.pages || 1)) break;
  }
  return itens.filter((i) => i.paidAt);
}

async function prepararAbas() {
  const meta = await sheets(ID(), '?fields=sheets.properties');
  const existentes = meta.sheets.map((s) => s.properties);
  const pedidos = [];
  const primeira = existentes[0];
  if (!existentes.some((a) => a.title === ABAS.bonus.nome)) {
    pedidos.push({ updateSheetProperties: { properties: { sheetId: primeira.sheetId, title: ABAS.bonus.nome, gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } });
  }
  if (!existentes.some((a) => a.title === ABAS.boas.nome)) {
    pedidos.push({ addSheet: { properties: { title: ABAS.boas.nome, gridProperties: { frozenRowCount: 1 } } } });
  }
  if (pedidos.length) await sheets(ID(), ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: pedidos }) });
  const depois = (await sheets(ID(), '?fields=sheets.properties')).sheets.map((s) => s.properties);
  for (const aba of Object.values(ABAS)) {
    aba.sheetId = depois.find((a) => a.title === aba.nome).sheetId;
    await sheets(ID(), `/values/${encodeURIComponent(aba.nome)}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [aba.cab] }) });
  }
}

async function faturasJaListadas(aba) {
  const r = await sheets(ID(), `/values/${encodeURIComponent(aba.nome)}!A2:K`);
  return new Set((r.values || []).map((l) => String(l[aba.fatura] || '')));
}

// A caixa de seleção vai só nas linhas novas: numa coluna inteira, as caixas vazias contariam como
// linhas preenchidas e o append passaria a escrever depois da última linha da planilha.
async function acrescentar(aba, linhas) {
  if (!linhas.length) return;
  const r = await sheets(ID(), `/values/${encodeURIComponent(aba.nome)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST', body: JSON.stringify({ values: linhas }),
  });
  const m = /!A(\d+):[A-Z]+(\d+)$/.exec(r.updates?.updatedRange || '');
  if (!m) return;
  await sheets(ID(), ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ setDataValidation: {
    range: { sheetId: aba.sheetId, startRowIndex: +m[1] - 1, endRowIndex: +m[2], startColumnIndex: aba.check, endColumnIndex: aba.check + 1 },
    rule: { condition: { type: 'BOOLEAN' } },
  } }] }) });
}

function veioDaLanding(i) {
  const u = i.utm || {};
  const s = String(u.source || '').toLowerCase();
  if (s === 'lp-teste' || s === 'bio') return 'Landing da bio';
  if (s === 'ads' && String(u.medium || '').toLowerCase() === 'landing-x') return 'Landing do anúncio';
  return null;
}

// Na assinatura, só a 1ª fatura é venda nova; as parcelas seguintes não ganham boas-vindas.
async function ehPrimeiraFatura(i) {
  if (!i.contractId || Number(i.total?.value || 0) >= 100) return true;
  const sub = await eduzz(`/myeduzz/v1/subscriptions/${i.contractId}`).catch(() => null);
  return !sub || String(sub.firstInvoiceId || '') === String(i.id);
}

module.exports = async function handler(req, res) {
  const chave = req.headers['x-chave'] || (req.query && req.query.k);
  if (!process.env.LISTAS_SECRET || chave !== process.env.LISTAS_SECRET) return res.status(401).end();
  try {
    await prepararAbas();
    const desde = dia(new Date(Math.max(Date.parse(INICIO_BONUS), Date.now() - 4 * 864e5)));
    const vendas = await vendasPagas(desde);
    const [jaBonus, jaBoas] = await Promise.all([faturasJaListadas(ABAS.bonus), faturasJaListadas(ABAS.boas)]);

    const bonus = vendas
      .filter((i) => DOBRO[i.product?.id] && i.paymentMethod === 'pix' && Number(i.total?.value || 0) >= 500)
      .filter((i) => i.paidAt.slice(0, 10) >= INICIO_BONUS && !jaBonus.has(String(i.id)))
      .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
      .map((i) => [quando(i.paidAt), i.buyer?.name || '', i.buyer?.email || '', "'" + digitos(i.buyer?.phone), "'" + i.id, DOBRO[i.product.id],
        Number(i.total.value).toFixed(2).replace('.', ','), somaMeses(i.paidAt, 24), somaMeses(i.paidAt, 27), false, '']);

    const boas = [];
    for (const i of vendas.sort((a, b) => a.paidAt.localeCompare(b.paidAt))) {
      const pagina = veioDaLanding(i);
      if (!pagina || i.paidAt.slice(0, 10) < INICIO_BOAS_VINDAS || jaBoas.has(String(i.id))) continue;
      if (!(await ehPrimeiraFatura(i))) continue;
      const tel = digitos(i.buyer?.phone);
      const plano = NOMES[i.product?.id] || i.product?.name || '';
      const msg = `Oi ${primeiroNome(i.buyer?.name)}! Aqui é do Time LIFE 🩷 Vi que você acabou de entrar, seja muito bem-vinda! Já conseguiu acessar? Quer uma ajuda pra dar os primeiros passos?`;
      const link = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(msg)}` : '';
      boas.push([quando(i.paidAt), i.buyer?.name || '', link, "'" + tel, plano, PAGAMENTO[i.paymentMethod] || i.paymentMethod || '', pagina, "'" + i.id, false, '', '']);
    }

    await acrescentar(ABAS.bonus, bonus);
    await acrescentar(ABAS.boas, boas);
    return res.status(200).json({ ok: true, vendas: vendas.length, bonus: bonus.length, boasVindas: boas.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, erro: String(e.message || e).slice(0, 200) });
  }
};
