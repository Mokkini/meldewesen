import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const depot  = searchParams.get('depot');
  const status = searchParams.get('status');   // 'ok' | 'problem' | ''
  const von    = searchParams.get('von');
  const bis    = searchParams.get('bis');
  const search = searchParams.get('search');

  const db = getDb();

  let query = `
    SELECT
      s.id, s.tour, s.fahrzeug, s.unternehmer,
      s.art, s.kdnr, s.kunde, s.strasse, s.plz, s.ort,
      s.sendungen, s.status,
      s.fahrer AS fahrer_manuell,
      s.grund, s.grund_freitext,
      s.erneute_zustellung, s.meldung_abrechnung,
      s.bearbeitet_am,
      h.depot, h.datum,
      f.fahrer_name, f.fahrer_tel
    FROM stops s
    JOIN hallenlisten h ON s.hallenliste_id = h.id
    LEFT JOIN fahrerzuordnungen f
      ON f.hallenliste_id = s.hallenliste_id AND f.tour = s.tour
    WHERE s.status != 'offen'
  `;
  const params: (string | number)[] = [];

  if (depot)  { query += ' AND h.depot = ?';      params.push(depot); }
  if (status) { query += ' AND s.status = ?';     params.push(status); }
  if (von)    { query += ' AND h.datum >= ?';     params.push(von); }
  if (bis)    { query += ' AND h.datum <= ?';     params.push(bis); }
  if (search) {
    query += ' AND (s.kunde LIKE ? OR s.tour LIKE ? OR f.fahrer_name LIKE ? OR s.fahrer LIKE ? OR s.kdnr LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like, like);
  }

  query += ' ORDER BY h.datum DESC, s.fahrzeug, s.reihenfolge';

  const rows = db.prepare(query).all(...params);
  return NextResponse.json(rows);
}
