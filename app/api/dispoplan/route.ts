import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/db';

function cleanTel(raw: unknown): string | null {
  if (raw == null) return null;
  // Strip leading backtick/apostrophe/acute (Excel text-number trick)
  return String(raw).replace(/^[`´''"]/, '').trim() || null;
}

function cleanName(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s || null;
}

// Find which hallenliste tour matches a dispoplan tour number
function matchTour(dispoTour: number, tourSet: Set<string>): string | null {
  const candidates = [
    String(dispoTour),
    String(1000 + dispoTour),
    String(2000 + dispoTour),
    String(3000 + dispoTour),
    String(dispoTour).padStart(4, '0'),
  ];
  for (const c of candidates) {
    if (tourSet.has(c)) return c;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const fd    = await req.formData();
    const file  = fd.get('file') as File | null;
    const depot = fd.get('depot') as string | null;
    const datum = fd.get('datum') as string | null;

    if (!file)  return NextResponse.json({ error: 'Keine Datei übergeben' }, { status: 400 });
    if (!depot) return NextResponse.json({ error: 'Depot fehlt' }, { status: 400 });
    if (!datum) return NextResponse.json({ error: 'Datum fehlt' }, { status: 400 });

    // Parse Excel
    const buffer  = Buffer.from(await file.arrayBuffer());
    const wb      = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('dispoplan'));
    if (!sheetName) {
      return NextResponse.json({ error: 'Kein "Dispoplan"-Blatt in der Datei gefunden' }, { status: 422 });
    }
    const ws   = wb.Sheets[sheetName];
    // Convert to 2D array; header is at row 4 (index 3), data starts at row 5 (index 4)
    const raw  = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

    // Find the actual header row (contains "Tour-Nr." or "Name")
    let headerRow = 3;
    for (let i = 0; i < Math.min(8, raw.length); i++) {
      const row = raw[i] as unknown[];
      if (row && row.some(c => c != null && String(c).includes('Tour'))) {
        headerRow = i;
        break;
      }
    }
    const dataRows = raw.slice(headerRow + 1);

    const db = getDb();

    // Find matching Hallenliste
    const hl = db.prepare('SELECT id FROM hallenlisten WHERE depot = ? AND datum = ? ORDER BY id DESC LIMIT 1')
      .get(depot, datum) as { id: number } | undefined;
    if (!hl) {
      return NextResponse.json({
        error: `Keine Hallenliste für ${depot} / ${datum} gefunden. Bitte zuerst die Hallenliste hochladen.`
      }, { status: 404 });
    }
    const hlId = hl.id;

    // Get distinct tours in this hallenliste
    const existingTours = db.prepare('SELECT DISTINCT tour FROM stops WHERE hallenliste_id = ?')
      .all(hlId) as { tour: string }[];
    const tourSet = new Set(existingTours.map(t => t.tour));

    // Parse Dispoplan rows
    const entries: {
      tour: string;
      dispoplan_tour: number;
      fhz_art: string | null;
      tu: string | null;
      fahrer_name: string | null;
      fahrer_tel: string | null;
      kennzeichen: string | null;
      tu_name: string | null;
      tu_tel: string | null;
      soll_ankunft: string | null;
      ist_ausfall: number;
    }[] = [];

    let skipped = 0;

    for (const row of dataRows) {
      const cols = row as unknown[];
      // Col 0: Tour-Nr. (integer)
      const tourNrRaw = cols[0];
      if (tourNrRaw == null || String(tourNrRaw).trim() === '') continue;
      const tourNr = parseInt(String(tourNrRaw), 10);
      if (isNaN(tourNr)) continue;

      const sollAnkunft = cleanName(cols[8]);
      const istAusfall  = sollAnkunft === 'Ausfall' ? 1 : 0;

      const matchedTour = matchTour(tourNr, tourSet);
      if (!matchedTour) {
        skipped++;
        continue;
      }

      entries.push({
        tour:          matchedTour,
        dispoplan_tour: tourNr,
        fhz_art:       cleanName(cols[1]),
        tu:            cleanName(cols[2]),
        fahrer_name:   cleanName(cols[3]),
        fahrer_tel:    cleanTel(cols[4]),
        kennzeichen:   cleanName(cols[5]),
        tu_name:       cleanName(cols[6]),
        tu_tel:        cleanTel(cols[7]),
        soll_ankunft:  istAusfall ? null : sollAnkunft,
        ist_ausfall:   istAusfall,
      });
    }

    // Upsert into fahrerzuordnungen
    const upsert = db.prepare(`
      INSERT INTO fahrerzuordnungen
        (hallenliste_id, tour, dispoplan_tour, fhz_art, tu, fahrer_name, fahrer_tel,
         kennzeichen, tu_name, tu_tel, soll_ankunft, ist_ausfall)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(hallenliste_id, tour) DO UPDATE SET
        dispoplan_tour = excluded.dispoplan_tour,
        fhz_art        = excluded.fhz_art,
        tu             = excluded.tu,
        fahrer_name    = excluded.fahrer_name,
        fahrer_tel     = excluded.fahrer_tel,
        kennzeichen    = excluded.kennzeichen,
        tu_name        = excluded.tu_name,
        tu_tel         = excluded.tu_tel,
        soll_ankunft   = excluded.soll_ankunft,
        ist_ausfall    = excluded.ist_ausfall
    `);

    const run = db.transaction(() => {
      for (const e of entries) {
        upsert.run(
          hlId, e.tour, e.dispoplan_tour, e.fhz_art, e.tu,
          e.fahrer_name, e.fahrer_tel, e.kennzeichen,
          e.tu_name, e.tu_tel, e.soll_ankunft, e.ist_ausfall
        );
      }
    });
    run();

    return NextResponse.json({
      ok:             true,
      hallenliste_id: hlId,
      zugeordnet:     entries.length,
      uebersprungen:  skipped,
    });
  } catch (err) {
    console.error('[dispoplan] upload error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
