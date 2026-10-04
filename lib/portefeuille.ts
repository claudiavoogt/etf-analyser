// Portefeuilleregels die voor de Analyse en de Jaarcheck gelden. Eén plek, zodat een regel nooit op twee plekken
// moet worden aangepast. Geen weging nodig: alleen sector, dividendtype, rating en 5-jaarsrendement.
// Alleen server-side gebruiken, nooit in de HTML.
import { kernType, kernMeldingen } from './kern';

export interface PETF {
  id: string;
  name: string;
  isin: string;
  sector: string;
  ms: string;
  div: string;
  r5: number | null;
  weight?: number;
}

export interface PFlag {
  t: 'r' | 'w';
  msg: string;
}

// 5-jaarsrendement: ontbreekt (oranje invoercontrole) of onder de richtlijn van 10% (rood). VWRA is uitgezonderd.
export function rendementFlags(e: PETF): PFlag[] {
  const f: PFlag[] = [];
  if (e.r5 == null && (e.name || (e.weight || 0) > 0)) {
    f.push({ t: 'w', msg: `${e.name || 'ETF'}: Let op: er is bij deze ETF geen 5 jaars rendement ingevoerd. Controleer je invoer.` });
  }
  if (e.isin !== 'IE00BK5BQT80') {
    if (e.r5 != null && e.r5 < 10) f.push({ t: 'r', msg: `${e.name}: Rendement 5 jaar ${e.r5.toFixed(1)}% — zit onder richtlijn van 10%` });
  }
  return f;
}

// Startregel: max. 2 ETF's op Neutral, de rest minimaal Bronze.
export function neutralFlags(etfs: PETF[]): PFlag[] {
  const neutrals = etfs.filter(e => e.ms === 'Neutral');
  if (neutrals.length > 2) {
    const namen = neutrals.map(e => e.name || 'ETF zonder naam').join(', ');
    return [{ t: 'r', msg: `${neutrals.length} ETF's op Neutral (${namen}). Bij aanvang mogen er maximaal 2 ETF's op Neutral staan, de rest moet minimaal Bronze zijn.` }];
  }
  return [];
}

// Sectorspreiding: per sector max. 1 aanvullende ETF (rood vanaf 2). Technologie is ruimer: 2 is oranje, vanaf 3 rood.
// De core telt niet mee. Brede-markt-ETF's en lege sectoren worden overgeslagen.
// Met alleenMet (ETF-id's) worden alleen sectoren gemeld waar een van die ETF's in zit.
export function sectorFlags(etfs: PETF[], alleenMet?: Set<string>): PFlag[] {
  const f: PFlag[] = [];
  const SECTOR_UITGEZONDERD = ['breed markt'];
  const SECTOR_MAX: Record<string, number> = { technologie: 2 };
  const perSector = new Map<string, { label: string; namen: string[]; ids: string[] }>();
  etfs.filter(e => e.id !== 'core').forEach(e => {
    const label = (e.sector || '').trim();
    const key = label.toLowerCase();
    if (!key || SECTOR_UITGEZONDERD.includes(key)) return;
    const g = perSector.get(key) || { label, namen: [], ids: [] };
    g.namen.push(e.name || 'ETF zonder naam');
    g.ids.push(e.id);
    perSector.set(key, g);
  });
  perSector.forEach((g, key) => {
    if (alleenMet && !g.ids.some(id => alleenMet.has(id))) return;
    const max = SECTOR_MAX[key] ?? 1;
    const n = g.namen.length;
    const namen = g.namen.join(', ');
    if (n > max) {
      const advies = max > 1
        ? `Dit wordt afgeraden, kies een andere sector of regio voor voldoende spreiding.`
        : `Maximaal 1 aanvullende ETF per sector is verstandig voor voldoende spreiding, kies een andere sector of regio.`;
      f.push({ t: 'r', msg: `${n} aanvullende ETF's in de sector ${g.label} (${namen}). ${advies}` });
    } else if (max > 1 && n > 1) {
      f.push({ t: 'w', msg: `Let op: ${n} aanvullende ETF's in de sector ${g.label} (${namen}) is het maximum. Zorg dat dit een bewuste keuze is en denk aan voldoende spreiding.` });
    }
  });
  return f;
}

// Uitkerend dividend: max. 1. uP = aandeel uitkerend in % van de weging (Analyse). De Jaarcheck kent geen weging en geeft 0.
export function uitkerendFlags(etfs: PETF[], uP: number, alleenMet?: Set<string>): PFlag[] {
  const f: PFlag[] = [];
  const uitkerendETFs = etfs.filter(e => e.div === 'Uitkeren');
  const alleMetDiv = etfs.filter(e => e.div);
  if (alleMetDiv.length > 0) {
    if (uitkerendETFs.length > 1) {
      if (!alleenMet || uitkerendETFs.some(e => alleenMet.has(e.id))) f.push({ t: 'r', msg: `${uitkerendETFs.length} ETF's met uitkerend dividend geselecteerd, max. 1 toegestaan.` });
    }
    else if (uP >= 100) f.push({ t: 'r', msg: `LET OP!! Kies voor herbeleggen ETF's om het compoundingeffect te maximaliseren.` });
    else if (uitkerendETFs.length >= 1) uitkerendETFs.forEach(e => {
      if (!alleenMet || alleenMet.has(e.id)) f.push({ t: 'w', msg: `${e.name}: Let op! Dividend wordt uitgekeerd ipv herbelegd. Dit geeft verlies van compounding effect.` });
    });
  }
  return f;
}

// Jaarcheck: meldingen over de portefeuille na je wijzigingen, alleen voor wat er door een nieuwe ETF verandert.
// Elke melding weet bij welke nieuwe ETF('s) hij hoort (ids), zodat de toelichting per ETF kan meebewegen.
export interface NieuweEtfMelding extends PFlag {
  ids: string[];
}

export function nieuweEtfMeldingen(portefeuille: PETF[], nieuwIds: Set<string>): NieuweEtfMelding[] {
  const lijst: NieuweEtfMelding[] = [];
  const voegToe = (x: PFlag, id: string) => {
    const bestaand = lijst.find(m => m.msg === x.msg && m.t === x.t);
    if (bestaand) { if (!bestaand.ids.includes(id)) bestaand.ids.push(id); }
    else lijst.push({ ...x, ids: [id] });
  };
  portefeuille.filter(e => nieuwIds.has(e.id)).forEach(e => {
    const alleen = new Set([e.id]);
    rendementFlags(e).forEach(x => voegToe(x, e.id));
    // Zonder sector of dividendtype kan de instapcheck op spreiding en dividend niet volledig draaien: melden, niet stil overslaan.
    if (!e.sector || !e.div) {
      voegToe({ t: 'w', msg: `${e.name || e.isin || 'Nieuwe ETF'}: sector of dividendtype is niet bekend, dus de check op spreiding en dividend is niet volledig gedaan. Zoek de ETF op via het naamveld of controleer de ISIN.` }, e.id);
    }
    // Neutral: een nieuwe ETF op Neutral telt mee voor het maximum van 2.
    if (e.ms === 'Neutral') {
      const neutrals = portefeuille.filter(x => x.ms === 'Neutral');
      if (neutrals.length > 2) {
        voegToe({ t: 'r', msg: `${neutrals.length} ETF's op Neutral (${neutrals.map(x => x.name || 'ETF zonder naam').join(', ')}). Maximaal 2 ETF's mogen op Neutral staan, de rest moet minimaal Bronze zijn.` }, e.id);
      }
    }
    sectorFlags(portefeuille, alleen).forEach(x => voegToe(x, e.id));
    uitkerendFlags(portefeuille, 0, alleen).forEach(x => voegToe(x, e.id));
    // Core-type: alleen als de nieuwe ETF zelf een core-type is (wereld of S&P 500).
    if (kernType(e.isin)) kernMeldingen(portefeuille).forEach(x => voegToe(x, e.id));
  });
  return lijst;
}
