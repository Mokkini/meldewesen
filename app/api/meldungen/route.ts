import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);

  const depot = searchParams.get('depot');
  const status = searchParams.get('status');
  const von = searchParams.get('von');
  const bis = searchParams.get('bis');
  const search = searchParams.get('search');

  let query = 'SELECT * FROM meldungen WHERE 1=1';
  const params: (string | number)[] = [];

  if (depot) { query += ' AND depot = ?'; params.push(depot); }
  if (status) { query += ' AND zustell_status = ?'; params.push(status); }
  if (von) { query += ' AND datum >= ?'; params.push(von); }
  if (bis) { query += ' AND datum <= ?'; params.push(bis); }
  if (search) {
    query += ' AND (fahrer LIKE ? OR sendungsnummer LIKE ? OR kunde LIKE ? OR tour LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  query += ' ORDER BY datum DESC, id DESC';

  const rows = db.prepare(query).all(...params);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const stmt = db.prepare(`
      INSERT INTO meldungen
        (datum, depot, tour, fahrer, unternehmer, typ, sendungsnummer, grund, grund_freitext,
         erneute_zustellung, meldung_abrechnung, tour_abgemeldet, kunde, adresse, zustell_status, erstellt_von)
      VALUES
        (@datum, @depot, @tour, @fahrer, @unternehmer, @typ, @sendungsnummer, @grund, @grund_freitext,
         @erneute_zustellung, @meldung_abrechnung, @tour_abgemeldet, @kunde, @adresse, @zustell_status, @erstellt_von)
    `);

    const result = stmt.run({
      datum: body.datum ?? new Date().toISOString().split('T')[0],
      depot: body.depot,
      tour: body.tour ?? null,
      fahrer: body.fahrer ?? null,
      unternehmer: body.unternehmer ?? null,
      typ: body.typ ?? 'zusteller',
      sendungsnummer: body.sendungsnummer ?? null,
      grund: body.grund ?? null,
      grund_freitext: body.grund_freitext ?? null,
      erneute_zustellung: body.erneute_zustellung ?? null,
      meldung_abrechnung: body.meldung_abrechnung ?? 'nein',
      tour_abgemeldet: body.tour_abgemeldet ?? 'ja',
      kunde: body.kunde ?? null,
      adresse: body.adresse ?? null,
      zustell_status: body.zustell_status ?? null,
      erstellt_von: body.erstellt_von ?? null,
    });

    const neu = db.prepare('SELECT * FROM meldungen WHERE id = ?').get(result.lastInsertRowid);
    return NextResponse.json(neu, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
