import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import * as XLSX from 'xlsx';

function parseFahrzeug(fahrzeug: string): { tour: string; unternehmer: string } {
  const idx = fahrzeug.indexOf('-');
  if (idx === -1) return { tour: fahrzeug, unternehmer: '' };
  return {
    tour: fahrzeug.slice(0, idx),
    unternehmer: fahrzeug.slice(idx + 1),
  };
}

function cleanStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;
    const depot    = (formData.get('depot') as string | null) ?? 'Unbekannt';
    const datum    = (formData.get('datum') as string | null) ?? new Date().toISOString().split('T')[0];

    if (!file) return NextResponse.json({ error: 'Keine Datei übertragen' }, { status: 400 });

    const buffer   = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Find the "Hallenliste" sheet
    const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('hallenliste') && !n.toLowerCase().includes('nicht'));
    if (!sheetName) return NextResponse.json({ error: 'Kein "Hallenliste"-Sheet gefunden' }, { status: 400 });

    const ws   = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null }) as unknown[][];

    // Row 0 = header: ['Fahrzeug','Reihenfolge','Zeit','Art','KdNr.','Kunde','Straße','PLZ','Ort','Sendungen',...]
    // Skip header and Depot rows
    const dataRows = rows.slice(1).filter(r => {
      const art = cleanStr(r[3]);
      return art && art !== 'Depot' && r[0] !== null;
    });

    const db = getDb();

    // Check if a Hallenliste for this depot+datum already exists and delete it
    const existing = db.prepare('SELECT id FROM hallenlisten WHERE depot = ? AND datum = ?').get(depot, datum) as { id: number } | undefined;
    if (existing) {
      db.prepare('DELETE FROM stops WHERE hallenliste_id = ?').run(existing.id);
      db.prepare('DELETE FROM hallenlisten WHERE id = ?').run(existing.id);
    }

    // Count unique fahrzeuge (tours)
    const fahrzeugeSet = new Set(dataRows.map(r => cleanStr(r[0])).filter(Boolean));

    // Insert Hallenliste header
    const hlResult = db.prepare(`
      INSERT INTO hallenlisten (depot, datum, dateiname, fahrzeuge, stops_total)
      VALUES (?, ?, ?, ?, ?)
    `).run(depot, datum, file.name, fahrzeugeSet.size, dataRows.length);

    const hlId = hlResult.lastInsertRowid as number;

    // Insert all stops
    const insertStop = db.prepare(`
      INSERT INTO stops
        (hallenliste_id, fahrzeug, tour, unternehmer, reihenfolge, zeit, art,
         kdnr, kunde, strasse, plz, ort, sendungen)
      VALUES
        (@hlId, @fahrzeug, @tour, @unternehmer, @reihenfolge, @zeit, @art,
         @kdnr, @kunde, @strasse, @plz, @ort, @sendungen)
    `);

    const insertMany = db.transaction((rows: unknown[][]) => {
      for (const row of rows) {
        const fahrzeug = cleanStr(row[0]) ?? '';
        const { tour, unternehmer } = parseFahrzeug(fahrzeug);
        insertStop.run({
          hlId,
          fahrzeug,
          tour,
          unternehmer,
          reihenfolge: row[1] !== null ? Number(row[1]) : null,
          zeit:        cleanStr(row[2]),
          art:         cleanStr(row[3]) ?? 'Zustellung',
          kdnr:        cleanStr(row[4]),
          kunde:       cleanStr(row[5]),
          strasse:     cleanStr(row[6]),
          plz:         cleanStr(row[7]),
          ort:         cleanStr(row[8]),
          sendungen:   row[9] !== null ? Number(row[9]) : null,
        });
      }
    });

    insertMany(dataRows);

    return NextResponse.json({
      ok: true,
      hallenliste_id: hlId,
      touren: fahrzeugeSet.size,
      stops: dataRows.length,
    }, { status: 201 });

  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
