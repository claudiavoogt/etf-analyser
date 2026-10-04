// Core-type vlag per ETF (server-side, nooit in de HTML).
// 'wereld' = wereld ETF die als core gekozen kan worden of daaraan gelijkwaardig is.
// 'sp500'  = echte S&P 500 tracker die als core gekozen kan worden of daaraan gelijkwaardig is.
// Geen vlag = aanjager op rendement (MSCI USA, MSCI North America, sector-, thema-, small cap ETF's, enz.).
//
// Bij elke nieuwe ETF in de database: vraag
// "Kan deze ETF als Core ETF gekozen worden of als gelijkwaardig aan een Core ETF gezien worden?"
// Ja => ISIN hieronder toevoegen als 'wereld' of 'sp500'.

export type KernType = 'wereld' | 'sp500';

export const KERN_ISINS: Record<string, KernType> = {
  // wereld, market-weighted
  IE00B4L5Y983: 'wereld', // iShares Core MSCI World
  IE00BFY0GT14: 'wereld', // SPDR MSCI World
  IE00BJ0KDQ92: 'wereld', // Xtrackers MSCI World
  IE00B0M62Q58: 'wereld', // iShares MSCI World Dist
  IE00BK5BQT80: 'wereld', // Vanguard FTSE All-World Acc
  IE00B3RBWM25: 'wereld', // Vanguard FTSE All-World Dist
  IE00BKX55T58: 'wereld', // Vanguard FTSE Developed World
  IE0003XJA0J9: 'wereld', // Amundi Prime All Country World
  IE00B3YLTY66: 'wereld', // SPDR MSCI ACWI IMI
  // wereld, ESG / SRI / screened
  IE00BZ02LR44: 'wereld', // Xtrackers MSCI World ESG
  IE00BCHWNQ94: 'wereld', // Xtrackers MSCI World ESG Screened
  IE00BFNM3J75: 'wereld', // iShares MSCI World Screened
  IE00BYX2JD69: 'wereld', // iShares MSCI World SRI
  LU0629459743: 'wereld', // UBS MSCI World Socially Responsible
  IE000Y77LGG9: 'wereld', // Amundi MSCI World SRI Climate Paris Aligned
  IE000CL68Z69: 'wereld', // Amundi MSCI World Climate Paris Aligned
  IE00BMDWYZ92: 'wereld', // JPM Carbon Transition Global Equity (CTB)
  // S&P 500 trackers
  IE00B5BMR087: 'sp500', // iShares Core S&P 500 Acc
  IE0031442068: 'sp500', // iShares Core S&P 500 Dist
  IE00B3XXRP09: 'sp500', // Vanguard S&P 500 Dist
  IE00BH4GPZ28: 'sp500', // SPDR S&P 500 Leaders
  IE00BHXMHK04: 'sp500', // UBS S&P 500 Scored & Screened
};

export interface KernMelding {
  t: 'r' | 'w';
  msg: string;
}

export function kernType(isin?: string): KernType | null {
  const k = (isin || '').trim().toUpperCase();
  return KERN_ISINS[k] || null;
}

function lijst(namen: string[]): string {
  return namen.join(', ');
}

// Regels:
// 2+ wereld            => rood, dubbele core
// 2+ sp500             => rood, dubbele core
// 1+ wereld en 1+ sp500 => oranje, overlap 60-70%, bewuste keuze?
export function kernMeldingen(etfs: { isin?: string; name?: string }[]): KernMelding[] {
  const wereld: string[] = [];
  const sp500: string[] = [];
  etfs.forEach(e => {
    const type = kernType(e.isin);
    const naam = (e.name || e.isin || 'ETF zonder naam').trim();
    if (type === 'wereld') wereld.push(naam);
    else if (type === 'sp500') sp500.push(naam);
  });

  const m: KernMelding[] = [];
  if (wereld.length >= 2) {
    m.push({
      t: 'r',
      msg: `Dubbele core: ${wereld.length} wereld ETF's (${lijst(wereld)}) die allebei als core kunnen dienen. Kies er 1 als core, de rest van je portefeuille zijn aanjagers op rendement.`,
    });
  }
  if (sp500.length >= 2) {
    m.push({
      t: 'r',
      msg: `Dubbele core: ${sp500.length} S&P 500 ETF's (${lijst(sp500)}). Dit is 2 keer dezelfde index, kies er maximaal 1.`,
    });
  }
  if (wereld.length >= 1 && sp500.length >= 1) {
    const wTxt = wereld.length > 1 ? `wereld ETF's (${lijst(wereld)}) bevatten` : `een wereld ETF (${lijst(wereld)}) bevat`;
    m.push({
      t: 'w',
      msg: `Let op: ${wTxt} al zo'n 60-70% overlap met de S&P 500 (${lijst(sp500)}). Zorg dat dit een bewuste keuze is.`,
    });
  }
  return m;
}
