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

// Resolve lookup key: prefer explicit kdnr, fall back to extracting a 4-6 digit
// number from the customer name (e.g. "FILIALE 03504" → "03504").
function resolveKey(kdnr: string | null, kunde: string | null): string | null {
  if (kdnr) return kdnr;
  if (!kunde) return null;
  const m = kunde.match(/\b(\d{4,6})\b/);
  if (!m) return null;
  return m[1].padStart(5, '0');
}

export function getZustellfenster(
  kdnr: string | null,
  datum: string | null,
  kunde?: string | null,
): ZustellFenster {
  const key = resolveKey(kdnr, kunde ?? null);
  if (!key) return null;

  const filiale = lookup[key];
  if (!filiale) return null;

  // Determine day of week from datum (YYYY-MM-DD) or today
  const d = datum ? new Date(datum + 'T00:00:00') : new Date();
  const dayKey = DAY_KEYS[d.getDay()];
  const fenster = filiale[dayKey];
  if (!fenster) return null;

  return fenster;
}
