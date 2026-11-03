// Vendas pagas da Eduzz (EDUZZ_API_KEY). Sem dependências.
const dia = (d) => d.toISOString().slice(0, 10);

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

module.exports = { eduzz, vendasPagas, dia };
