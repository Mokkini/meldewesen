import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getZustellfenster } from '@/lib/filialen-zeiten';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);

  const datum  = searchParams.get('datum');
  const depot  = searchParams.get('depot');
  const status = searchParams.get('status');
  const hlId   = searchParams.get('hallenliste_id');

  let query = `
    SELECT s.*, h.depot, h.datum,
      f.fahrer_name, f.fahrer_tel, f.tu_name, f.tu_tel, f.kennzeichen
    FROM stops s
    JOIN hallenlisten h ON s.hallenliste_id = h.id
    LEFT JOIN fahrerzuordnungen f
      ON f.hallenliste_id = s.hallenliste_id AND f.tour = s.tour
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (hlId)   { query += ' AND s.hallenliste_id = ?'; params.push(Number(hlId)); }
  if (datum)  { query += ' AND h.datum = ?';           params.push(datum); }
  if (depot)  { query += ' AND h.depot = ?';           params.push(depot); }
  if (status) { query += ' AND s.status = ?';          params.push(status); }

  query += ' ORDER BY s.fahrzeug, s.reihenfolge';

  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

  // Enrich each stop with the delivery time window for the stop's date
  const enriched = rows.map(row => ({
    ...row,
    zustellfenster: getZustellfenster(
      row.kdnr  as string | null,
      row.datum as string | null,
      row.kunde as string | null,
    ),
  }));

  return NextResponse.json(enriched);
}
