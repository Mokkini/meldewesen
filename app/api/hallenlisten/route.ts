import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT h.*,
      COUNT(s.id)                                   AS stops_total,
      SUM(CASE WHEN s.status = 'ok'      THEN 1 ELSE 0 END) AS stops_ok,
      SUM(CASE WHEN s.status = 'problem' THEN 1 ELSE 0 END) AS stops_problem,
      SUM(CASE WHEN s.status = 'offen'   THEN 1 ELSE 0 END) AS stops_offen
    FROM hallenlisten h
    LEFT JOIN stops s ON s.hallenliste_id = h.id
    GROUP BY h.id
    ORDER BY h.datum DESC, h.erstellt_am DESC
    LIMIT 30
  `).all();
  return NextResponse.json(rows);
}
