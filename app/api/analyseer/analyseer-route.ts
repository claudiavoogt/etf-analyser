import { NextRequest, NextResponse } from 'next/server';

interface ETF {
  id: string;
  name: string;
  isin: string;
  weight: number;
  ter: number | null;
  sector: string;
  region: string;
  msStars: string;
  ms: string;
  div: string;
  aum: number | null;
  holdings: number | null;
  r5: number | null;
  r10: number | null;
  r15: number | null;
}

interface Flag {
  t: 'r' | 'w';
  msg: string;
}

interface AnalyseRequest {
  etfs: ETF[];
  horizon: string;
  inleg: number;
}

function getHorizonRange(h: string): { min: number; max: number; label: string } | null {
  if (h === '10-15') return { min: 70, max: 80, label: '10–15 jaar' };
  if (h === '15-20') return { min: 60, max: 70, label: '15–20 jaar' };
  if (h === '20+') return { min: 50, max: 60, label: '>20 jaar' };
  return null;
}

function getMaxETFs(inleg: number): number {
  if (!inleg || inleg < 150) return 3;
  if (inleg <= 300) return 4;
  return 5;
}

function getFlags(etfs: ETF[], tw: number, horizon: string, inleg: number): Flag[] {
  const f: Flag[] = [];
  const hr = getHorizonRange(horizon);
  const minC = hr ? hr.min : 50;
  const maxC = hr ? hr.max : 80;

  if (tw > 100.5) f.push({ t: 'w', msg: `Totale weging ${tw.toFixed(0)}% — meer dan 100%` });
  if (tw < 99 && tw > 0 && etfs.length > 0) f.push({ t: 'w', msg: `Totale weging ${tw.toFixed(0)}% — nog niet volledig belegd` });

  const core = etfs.find(e => e.id === 'core');
  if (core && !isNaN(core.weight) && (core.weight < minC || core.weight > maxC)) {
    f.push({ t: 'w', msg: `Core weging ${core.weight.toFixed(0)}% — richtlijn bij jouw horizon is ${minC}–${maxC}%` });
  }

  if (inleg > 0) {
    const maxAllowed = getMaxETFs(inleg);
    if (etfs.length > maxAllowed) {
      f.push({ t: 'r', msg: `${etfs.length} ETF's ingevuld maar bij €${inleg}/maand pas ${maxAllowed} aan te raden (min. €25 per ETF)` });
    }
    etfs.forEach(e => {
      const inlegVoorETF = (e.weight / 100) * inleg;
      if (inlegVoorETF > 0 && inlegVoorETF < 25) {
        f.push({ t: 'r', msg: `${e.name}: bij €${inleg}/maand en ${e.weight.toFixed(0)}% weging gaat er €${inlegVoorETF.toFixed(0)} naartoe — onder het minimum van €25` });
      }
    });
  }

  etfs.forEach(e => {
    if (e.ms === 'Neutral') f.push({ t: 'w', msg: `${e.name}: Aandachtspunt Neutral: deze ETF zit onder Bronze minimum. Blijf deze ETF monitoren.` });
    if (e.ms === 'Negative') f.push({ t: 'r', msg: `${e.name}: Morningstar Negative — direct aandachtspunt` });
    if (e.msStars && e.msStars.length <= 2) f.push({ t: 'r', msg: `${e.name} - Let op: deze ETF heeft niet voldoende Morningstar sterren. Blijf de ETF monitoren.` });
    if (e.ter && e.ter > 0.5) f.push({ t: 'w', msg: `${e.name}: Kosten (TER) ${e.ter.toFixed(2)}% — boven 0.50% richtlijn` });
    if (e.aum && e.aum < 500) f.push({ t: 'r', msg: `${e.name}: Fondsomvang €${e.aum.toLocaleString('nl-NL')}M — onder het minimum van €500 mln. Verhoogd liquiditeits- en sluitingsrisico.` });

    if (e.isin !== 'IE00BK5BQT80') {
      if (e.r5 != null && e.r5 < 10) f.push({ t: 'r', msg: `${e.name}: Rendement 5 jaar ${e.r5.toFixed(1)}% — voldoet niet aan minimum van 10%` });
      if (e.r10 != null && e.r10 < 7) f.push({ t: 'r', msg: `${e.name}: Rendement 10 jaar ${e.r10.toFixed(1)}% — voldoet niet aan minimum van 7%` });
    }
  });

  const uitkerendETFs = etfs.filter(e => e.div === 'Uitkeren');
  const alleMetDiv = etfs.filter(e => e.div);
  if (alleMetDiv.length > 0) {
    const uW = uitkerendETFs.reduce((s, e) => s + e.weight, 0);
    const dT = alleMetDiv.reduce((s, e) => s + e.weight, 0);
    const uP = dT > 0 ? (uW / dT) * 100 : 0;
    if (uP >= 100) f.push({ t: 'r', msg: `LET OP!! Kies voor herbeleggen ETF's om het compoundingeffect te maximaliseren.` });
    else if (uitkerendETFs.length >= 1) uitkerendETFs.forEach(e => f.push({ t: 'w', msg: `${e.name}: Let op! Dividend wordt uitgekeerd ipv herbelegd. Dit geeft verlies van compounding effect.` }));
  }

  return f;
}

const headers = { 'Access-Control-Allow-Origin': '*' };

export async function OPTIONS() {
  return new Response(null, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  let body: AnalyseRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400, headers });
  }

  const { etfs = [], horizon = '', inleg = 0 } = body;

  const tw = etfs.reduce((s, e) => s + e.weight, 0);
  const tl = etfs.filter(e => e.ter && !isNaN(e.ter));
  const wt = tl.reduce((s, e) => s + (e.ter! * e.weight / 100), 0);

  const de = etfs.filter(e => e.div);
  const hW = de.filter(e => e.div === 'Herbeleggen').reduce((s, e) => s + e.weight, 0);
  const uW = de.filter(e => e.div === 'Uitkeren').reduce((s, e) => s + e.weight, 0);
  const dT = hW + uW;

  const flags = getFlags(etfs, tw, horizon, inleg);
  const rodeFlagCount = flags.filter(f => f.t === 'r').length;

  return NextResponse.json({
    metrics: {
      ter: tl.length ? parseFloat(wt.toFixed(2)) : null,
      weight: parseFloat(tw.toFixed(0)),
      flagCount: rodeFlagCount,
      herb: dT > 0 ? parseFloat(hW.toFixed(0)) : null,
      uit: dT > 0 ? parseFloat(uW.toFixed(0)) : null,
      uitPct: dT > 0 ? parseFloat(((uW / dT) * 100).toFixed(0)) : null,
    },
    flags,
  }, { headers });
}
