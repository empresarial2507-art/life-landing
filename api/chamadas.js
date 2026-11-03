// Controle semanal das chamadas da Paloma no Instagram, nas abas "Chamadas", "Semanas" e "Régua" da planilha de
// medição (SHEET_ID). O GitHub Actions chama a cada 30 min com a chave LISTAS_SECRET.
//   Chamadas: uma linha por chamada. A equipe da Paloma marca o status, as visualizações e os toques; este endpoint
//   preenche entradas, vendas e caixa pela etiqueta (utm_campaign) ou, no WhatsApp, pela janela de 48 h do time.
//   Semanas: caixa real da Eduzz por semana contra a meta (R$ 4 mil por dia).
//   Teste: as 4 chamadas de teste (uma por destino) ordenadas por R$ por mil visualizações em 48 h.
// A planilha está em pt_BR: nas fórmulas, o separador é ponto e vírgula.
// Na primeira chamada, cria as abas com o plano de novembro. Depois disso, a planilha manda: o endpoint só
// escreve as colunas automáticas (K, L e M) e a coluna de caixa real das semanas.
// Env: EDUZZ_API_KEY, GOOGLE_SA_JSON, SHEET_ID, LISTAS_SECRET.
const { sheets } = require('../lib/google');
const { vendasPagas, dia } = require('../lib/eduzz');

const MAPA = '1voFxbt5w9SkANGWhdmeG5h937_oh4z9RlAi6Du6Bi84'; // "Mapa LIFE · Cadastros"
const META_DIA = 4000;
const PISO_DIA = 3000;
const TIME = ['pedro', 'giulia'];
const LANDING = 'https://life-landing-nine.vercel.app/?utm_source=stories&utm_medium=instagram&utm_campaign=';
const MAPA_LINK = 'https://mapa-life.vercel.app/?utm_source=stories&utm_medium=instagram&utm_campaign=';

const CAB = ['Semana', 'Data', 'Tipo', 'Destino', 'O que a Paloma fala', 'Frase ou etiqueta', 'Link do sticker', 'Status',
  'Visualizações (equipe da Paloma)', 'Toques no link (equipe da Paloma)', 'Entradas', 'Vendas', 'Caixa (R$)',
  'Piso (R$)', 'Provável (R$)', 'Resultado', 'Como conta', 'Observação', 'Caixa em 48 h (R$)', 'R$ por mil visualizações (48 h)'];
const COMO = {
  'Landing': 'Entradas = visitas com a etiqueta. Vendas e caixa = compras pagas com a etiqueta em 7 dias.',
  'Mapa LIFE': 'Entradas = cadastros com a etiqueta. Vendas e caixa = compras dessas pessoas em 7 dias, por qualquer canal.',
  'WhatsApp': 'Entradas = o time conta as conversas com a frase (escrever à mão). Caixa = vendas do Pedro e da Giulia no dia e no seguinte, acima da média dos 7 dias anteriores.',
  'Aula aberta': 'Entradas = cadastros na página da aula. Vendas e caixa = compras dessas pessoas em 7 dias.',
};
// Plano de 03/11/2026, revisto no mesmo dia: no mínimo 2 chamadas por semana. Fase de teste (05 a 13/11): um destino
// por chamada, comparados por R$ por mil visualizações em 48 h (aba Teste). Fase de repetição (17 a 30/11): o destino
// das linhas é provisório até a leitura de 15/11 (relatorios/2026-11-03_plano-chamadas-novembro.md no life-growth-os).
const PLANO = [
  ['Out', '31/10/2026', 'Referência', 'Mapa LIFE', 'Lançamento do Mapa: "fiz um presente pra você descobrir onde o seu corpo tá pedindo atenção"', 'sem etiqueta própria (utm_source=stories)', MAPA_LINK.replace('&utm_medium=instagram&utm_campaign=', ''), 'Feita', '', '', 1013, 17, 4232, 3000, '', 'Medido à mão em 03/11: 1.013 cadastros, 17 compraram depois de fazer o Mapa, R$ 4.232 de caixa em 4 dias (mais parcelas a receber)'],
  ['S1', '05/11/2026', 'Teste', 'Landing', 'Faltam 8 semanas pro ano acabar: dá pra chegar em dezembro diferente. A Black chegou antes: 2 anos pelo preço de 1, e no Pix ganha +3 meses', 'chamada-0511', LANDING + 'chamada-0511', 'Planejada', '', '', '', '', '', 3000, 6000, 'Teste 1 de 4: landing (venda sem atendimento)'],
  ['S1', '07/11/2026', 'Teste', 'Mapa LIFE', 'Resultado coletivo: "X musas fizeram o Mapa e a área que mais apareceu foi Y" (número real da planilha do Mapa). Ainda não fez? Link aqui', 'chamada-0711', MAPA_LINK + 'chamada-0711', 'Planejada', '', '', '', '', '', 1500, 3000, 'Teste 2 de 4. 2ª chamada do Mapa: quem já fez não refaz, por isso o piso é a metade'],
  ['S2', '09/11/2026', 'Teste', 'WhatsApp', 'Dia do salário + Black das Alunas: a Black chegou primeiro pra quem me acompanha, e quem já é aluna troca o plano pelo Dobro', 'Paloma, quero minha Black!! 🖤💛', 'ManyChat → WhatsApp do time, com a frase pronta', 'Planejada', '', '', '', '', '', 3500, 10000, 'Teste 3 de 4. Pedro e Giulia até as 22h nos dias 09 e 10'],
  ['S2', '13/11/2026', 'Teste', 'Aula aberta', 'Sexta-feira 13: o único medo que eu quero tirar de você é o de começar. Liberei uma aula do LIFE de graça até domingo', 'chamada-1311', 'a construir (página da aula)', 'Depende', '', '', '', '', '', 1500, 3000, 'Teste 4 de 4. A Paloma escolhe a aula até 07/11; a página fica pronta até 10/11'],
  ['S3', '17/11/2026', 'Repetição', 'Landing', 'Prova social: quem entrou na Black semana passada já tá na comunidade (prints de alunas, sem antes e depois), e ainda dá tempo', 'chamada-1711', LANDING + 'chamada-1711', 'Planejada', '', '', '', '', '', 3000, 6000, 'Destino provisório: em 15/11 vira o 1º do teste. Se virar WhatsApp, frase "Paloma, entrei na Black?"'],
  ['S3', '19/11/2026', 'Repetição', 'WhatsApp', 'Véspera do feriadão: feriado não é motivo pra largar tudo, é o melhor dia pra começar com calma. Dúvida sobre a Black? Manda a frase', 'QUERO A BLACK', 'ManyChat → WhatsApp do time, com a frase pronta', 'Planejada', '', '', '', '', '', 3500, 8000, 'Destino provisório: em 15/11 vira o 2º do teste (ou o 1º, se ele ganhou com folga). Se virar landing, etiqueta chamada-1911'],
  ['S4', '24/11/2026', 'Repetição', 'WhatsApp', 'Abriu a semana da Black: termina segunda, dia 30. Menos de R$ 1 por dia por 2 anos de LIFE', 'Paloma, quero a Black!! 🖤💛', 'ManyChat → WhatsApp do time, com a frase pronta', 'Planejada', '', '', '', '', '', 3500, 8000, 'Destino provisório: em 15/11 vira o 1º do teste. Se virar landing, etiqueta chamada-2411'],
  ['S4', '27/11/2026', 'Repetição', 'Landing', 'Black Friday: hoje todo mundo compra coisa que nem vai usar. Compra uma que você vai usar por 2 anos. Termina 30/11 às 23h59', 'chamada-2711', LANDING + 'chamada-2711', 'Planejada', '', '', '', '', '', 5000, 12000, 'Destino provisório: em 15/11 vira o 1º do teste. Time até as 23h para dúvidas. Se virar WhatsApp, frase "BLACK FRIDAY"'],
  ['S4', '30/11/2026', 'Repetição (extra)', 'Landing', 'Último dia: termina hoje às 23h59. Depois disso, só no preço normal', 'chamada-3011', LANDING + 'chamada-3011', 'Planejada', '', '', '', '', '', 4000, 8000, 'A 9ª chamada. Destino provisório: em 15/11 vira o 1º do teste. Se virar WhatsApp, frase "ÚLTIMO DIA"'],
];
const SEMANAS = [
  ['S1', '01/11/2026', '08/11/2026'], ['S2', '09/11/2026', '15/11/2026'], ['S3', '16/11/2026', '22/11/2026'],
  ['S4', '23/11/2026', '30/11/2026'],
];
const CAB_SEM = ['Semana', 'De', 'Até', 'Dias', 'Meta (R$)', 'Piso sem chamada (R$)', 'Caixa real (R$)', 'Chamadas planejadas',
  'Chamadas feitas', 'Caixa das chamadas (R$)', 'Falta para a meta (R$)', 'Situação'];
const REGUA = [
  ['Destino', 'Entrada', 'Piso por entrada (R$)', 'Entradas no piso', 'Piso por chamada (R$)', 'De onde veio'],
  ['Landing', 'visita', 5, 600, 3000, 'Outubro: R$ 22,1 mil em 4.368 visitas (R$ 5). 02 e 03/11, com a copy da Black: R$ 2.445 em cerca de 150 visitas (R$ 16), amostra pequena'],
  ['Mapa LIFE', 'cadastro', 4, 750, 3000, '31/10: 1.013 cadastros, R$ 4.232 de caixa em 4 dias (R$ 4,20). Na 2ª chamada, metade dos cadastros'],
  ['WhatsApp com frase', 'conversa', 23, 150, 3500, 'Time em ago/set: R$ 23 de caixa por conversa (hipótese). Presentinho de 31/08: 267 conversas e 17,6% de compra'],
  ['Aula aberta', 'cadastro', 3, 500, 1500, 'Hipótese, sem medição: um pouco abaixo do Mapa'],
  [],
  ['Dia comum, sem chamada', '', '', '', 3000, 'Mediana de 19 a 31/10 com o anúncio da Natália no ar. Sem o anúncio, cerca de R$ 2,5 mil'],
  ['Meta por dia', '', '', '', 4000, 'R$ 120 mil em 30 dias'],
  [],
  ['Regra', 'Chamada abaixo do piso: a próxima do mesmo destino troca o motivo ou o destino. Duas acima do provável: o destino ganha mais uma chamada.'],
];

const TESTE_CAB = ['Destino', 'Data', 'Visualizações', 'Caixa em 48 h (R$)', 'R$ por mil visualizações (48 h)', 'Posição', 'Caixa em 7 dias (R$)'];
const TESTE_REGRA = [
  [],
  ['Regra', 'Leitura em 15/11. O 1º colocado fica com as chamadas de 17, 24, 27 e 30/11; o 2º fica com a de 19/11. Se o 2º ficar a menos de 20% do 1º, os dois se alternam (17 e 24 para o 1º, 19 e 27 para o 2º, 30 para o 1º).'],
  ['Limites', 'Mapa LIFE repete no máximo uma vez (quem já fez não refaz). Aula aberta só repete com outra aula. Uma chamada abaixo do piso na fase de repetição: a próxima troca o motivo, não o destino.'],
];

const ID = () => process.env.SHEET_ID;
const iso = (br) => `${br.slice(6, 10)}-${br.slice(3, 5)}-${br.slice(0, 2)}`;
const maisDias = (s, n) => dia(new Date(Date.parse(s + 'T12:00:00Z') + n * 864e5));
const valor = (i) => Number(i.total?.value || 0);
const fatia = (vendas, de, ate) => vendas.filter((i) => i.paidAt.slice(0, 10) >= de && i.paidAt.slice(0, 10) <= ate);
const soma = (l) => l.reduce((t, i) => t + valor(i), 0);

function linhasDoPlano() {
  return PLANO.map((l, k) => {
    const r = k + 2;
    const c = l.slice(0, 15).map((v, j) => (j === 1 ? "'" + v : v));
    return [...c, `=IF(M${r}="";"";IF(M${r}>=N${r};"acima do piso";"abaixo do piso"))`, COMO[l[3]] || '', l[15] || '', '',
      `=IF(OR(I${r}="";S${r}="");"";ROUND(S${r}/I${r}*1000))`];
  });
}

async function prepararAbas() {
  const meta = await sheets(ID(), '?fields=sheets.properties');
  const tem = (t) => meta.sheets.some((s) => s.properties.title === t);
  const novas = ['Chamadas', 'Semanas', 'Régua', 'Teste'].filter((t) => !tem(t));
  if (!novas.length) return;
  await sheets(ID(), ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: novas.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }) });
  const put = (faixa, values) => sheets(ID(), `/values/${encodeURIComponent(faixa)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values }) });
  if (novas.includes('Chamadas')) await put('Chamadas!A1', [CAB, ...linhasDoPlano()]);
  if (novas.includes('Semanas')) {
    const linhas = SEMANAS.map(([s, de, ate], k) => {
      const r = k + 2;
      const dias = Math.round((Date.parse(iso(ate)) - Date.parse(iso(de))) / 864e5) + 1;
      return [s, "'" + de, "'" + ate, dias, dias * META_DIA, dias * PISO_DIA, '',
        `=COUNTIFS(Chamadas!A:A;A${r};Chamadas!H:H;"<>Cancelada")`, `=COUNTIFS(Chamadas!A:A;A${r};Chamadas!H:H;"Feita")`,
        `=SUMIFS(Chamadas!M:M;Chamadas!A:A;A${r})`, `=IF(G${r}="";"";MAX(0;E${r}-G${r}))`, ''];
    });
    const t = SEMANAS.length + 1;
    linhas.push(['Mês', "'01/11/2026", "'30/11/2026", `=SUM(D2:D${t})`, `=SUM(E2:E${t})`, `=SUM(F2:F${t})`, `=SUM(G2:G${t})`,
      `=SUM(H2:H${t})`, `=SUM(I2:I${t})`, `=SUM(J2:J${t})`, `=MAX(0;E${t + 1}-G${t + 1})`, '']);
    await put('Semanas!A1', [CAB_SEM, ...linhas]);
  }
  if (novas.includes('Régua')) await put('Régua!A1', REGUA);
  if (novas.includes('Teste')) {
    const testes = PLANO.map((l, k) => [l, k + 2]).filter(([l]) => l[2] === 'Teste');
    const fim = testes.length + 1;
    const linhas = testes.map(([, c], k) => [`=Chamadas!D${c}`, `=Chamadas!B${c}`, `=Chamadas!I${c}`, `=Chamadas!S${c}`, `=Chamadas!T${c}`,
      `=IF(E${k + 2}="";"";RANK(E${k + 2};E$2:E$${fim}))`, `=Chamadas!M${c}`]);
    await put('Teste!A1', [TESTE_CAB, ...linhas, ...TESTE_REGRA]);
  }
}

// Cadastros do Mapa: Data (0), Comprou (12), Valor (14), Data da compra (15, gravada 3 h antes do horário de
// Brasília pelo conferir.js do Mapa), Origem (17, a query do link de entrada).
async function cadastrosMapa() {
  const v = (await sheets(MAPA, '/values/Cadastros!A2:R')).values || [];
  return v.map((l) => {
    const d = String(l[0] || '');
    const compra = String(l[15] || '');
    return {
      em: `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)} ${d.slice(12, 17)}`,
      campanha: (/utm_campaign=([^&]+)/.exec(String(l[17] || '')) || [])[1] || '',
      comprou: l[12] === 'Sim',
      valor: Number(String(l[14] || '0').replace(/\./g, '').replace(',', '.')) || 0,
      compraEm: compra ? new Date(Date.parse(compra.replace(' ', 'T') + ':00Z') + 3 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : '',
    };
  });
}

async function visitasLanding() {
  const v = (await sheets(ID(), '/values/Eventos!A2:I')).values || [];
  const por = {};
  for (const l of v) {
    if (l[1] !== 'visita' || !l[8]) continue;
    (por[l[8]] = por[l[8]] || new Set()).add(l[3] || l[4]);
  }
  return por;
}

function medir(linha, hoje, vendas, mapa, visitas) {
  const [, data, , destino, , etiqueta] = linha;
  const d = iso(String(data).replace(/^'/, ''));
  if (destino === 'WhatsApp') {
    const doTime = vendas.filter((i) => TIME.includes(String(i.utm?.source || '').toLowerCase()));
    const janela = fatia(doTime, d, maisDias(d, 1));
    const normal = soma(fatia(doTime, maisDias(d, -7), maisDias(d, -1))) / 7 * 2;
    const caixa = Math.round(soma(janela) - normal);
    return { entradas: null, vendas: janela.length, caixa, caixa48: caixa };
  }
  const fim = maisDias(d, 7);
  const fim48 = maisDias(d, 2);
  if (destino === 'Mapa LIFE' || destino === 'Aula aberta') {
    const cad = mapa.filter((c) => c.campanha === etiqueta);
    const compras = cad.filter((c) => c.comprou && c.compraEm > c.em && c.compraEm.slice(0, 10) < fim);
    const valorDe = (l) => Math.round(l.reduce((t, c) => t + c.valor, 0));
    return { entradas: cad.length, vendas: compras.length, caixa: valorDe(compras), caixa48: valorDe(compras.filter((c) => c.compraEm.slice(0, 10) < fim48)) };
  }
  const pagas = vendas.filter((i) => String(i.utm?.campaign || '') === etiqueta && i.paidAt.slice(0, 10) >= d && i.paidAt.slice(0, 10) < fim);
  return { entradas: visitas[etiqueta] ? visitas[etiqueta].size : 0, vendas: pagas.length, caixa: Math.round(soma(pagas)),
    caixa48: Math.round(soma(pagas.filter((i) => i.paidAt.slice(0, 10) < fim48))) };
}

module.exports = async function handler(req, res) {
  const chave = req.headers['x-chave'] || (req.query && req.query.k);
  if (!process.env.LISTAS_SECRET || chave !== process.env.LISTAS_SECRET) return res.status(401).end();
  try {
    await prepararAbas();
    const hoje = dia(new Date(Date.now() - 3 * 3600e3));
    const linhas = (await sheets(ID(), '/values/Chamadas!A2:H')).values || [];
    const [vendas, mapa, visitas] = await Promise.all([vendasPagas(maisDias('2026-11-01', -7)), cadastrosMapa(), visitasLanding()]);

    const escritas = [];
    linhas.forEach((l, k) => {
      const data = String(l[1] || '').replace(/^'/, '');
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data) || l[2] === 'Referência' || l[7] === 'Cancelada' || iso(data) > hoje) return;
      if (l[3] === 'Aula aberta' && l[7] === 'Depende') return;
      const m = medir(l, hoje, vendas, mapa, visitas);
      const r = k + 2;
      if (m.entradas !== null) escritas.push({ range: `Chamadas!K${r}`, values: [[m.entradas]] });
      escritas.push({ range: `Chamadas!L${r}:M${r}`, values: [[m.vendas, m.caixa]] });
      escritas.push({ range: `Chamadas!S${r}`, values: [[m.caixa48]] });
    });
    // Situação contra o esperado até agora (meta e piso proporcionais aos dias corridos da semana).
    const agora = new Date(Date.now() - 3 * 3600e3);
    const horaDoDia = (agora.getUTCHours() + agora.getUTCMinutes() / 60) / 24;
    SEMANAS.forEach(([, de, ate], k) => {
      if (iso(de) > hoje) return;
      const caixa = Math.round(soma(fatia(vendas, iso(de), iso(ate))));
      const dias = Math.round((Date.parse(iso(ate)) - Date.parse(iso(de))) / 864e5) + 1;
      const corridos = iso(ate) < hoje ? dias : Math.round((Date.parse(hoje) - Date.parse(iso(de))) / 864e5) + horaDoDia;
      const fr = corridos / dias;
      const situacao = caixa >= dias * META_DIA * fr ? (fr < 1 ? 'no ritmo da meta' : 'bateu a meta')
        : caixa >= dias * PISO_DIA * fr ? 'acima do piso' : 'abaixo do piso';
      escritas.push({ range: `Semanas!G${k + 2}`, values: [[caixa]] });
      escritas.push({ range: `Semanas!L${k + 2}`, values: [[fr < 1 ? `${situacao} (parcial)` : situacao]] });
    });
    escritas.push({ range: `Semanas!A${SEMANAS.length + 4}`, values: [[`Atualizado em ${hoje.slice(8, 10)}/${hoje.slice(5, 7)} às ${new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16)}`]] });
    await sheets(ID(), '/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: escritas }) });
    return res.status(200).json({ ok: true, chamadas: linhas.length, escritas: escritas.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, erro: String(e.message || e).slice(0, 200) });
  }
};

module.exports.config = { maxDuration: 60 };
// Para regravar o plano à mão (apaga as linhas da aba Chamadas e escreve o PLANO de novo).
module.exports.linhasDoPlano = linhasDoPlano;
module.exports.CAB = CAB;
