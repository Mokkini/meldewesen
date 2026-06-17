import data from './filialen-zeiten.json';

type Fenster = { von: string | null; bis: string | null; von2: string | null; bis2: string | null };
type FilialeZeiten = Partial<Record<'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so', Fenster>>;

const lookup = data as Record<string, FilialeZeiten>;

// JS getDay(): 0=So, 1=Mo, 2=Di, 3=Mi, 4=Do, 5=Fr, 6=Sa
const DAY_KEYS: Array<'so' | 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa'> =
  ['so', 'mo', 'di', 'mi', 'do', 'fr', 'sa'];

export type ZustellFenster = {
  von: string | null;
  bis: string | null;
  von2: string | null;
  bis2: string | null;
} | null;

// Resolve the lookup key. Strategy:
// 1. kdnr direct match  (e.g. "03304")
// 2. kdnr padded to 5 digits (e.g. "3304" → "03304")
// 3. number extracted from kunde name (e.g. "FILIALE 03304" → "03304")
function resolveFiliale(kdnr: string | null, kunde: string | null): FilialeZeiten | undefined {
  if (kdnr) {
    return lookup[kdnr] ?? lookup[kdnr.padStart(5, '0')];
  }
  if (kunde) {
    const m = kunde.match(/\b(\d{4,6})\b/);
    if (m) return lookup[m[1].padStart(5, '0')];
  }
  return undefined;
}

export function getZustellfenster(
  kdnr: string | null,
  datum: string | null,
  kunde?: string | null,
): ZustellFenster {
  const filiale = resolveFiliale(kdnr, kunde ?? null);
  if (!filiale) return null;

  const d = datum ? new Date(datum + 'T00:00:00') : new Date();
  const dayKey = DAY_KEYS[d.getDay()];
  const fenster = filiale[dayKey];
  if (!fenster) return null;

  return fenster;
}
