import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hlId = searchParams.get('hallenliste_id');
  if (!hlId) return NextResponse.json({ error: 'hallenliste_id fehlt' }, { status: 400 });

  const db = getDb();

  // Gesamt-KPIs
  const gesamt = db.prepare(`
    SELECT
      COUNT(*)                                             AS total,
      SUM(CASE WHEN status = 'ok'      THEN 1 ELSE 0 END) AS ok,
      SUM(CASE WHEN status = 'problem' THEN 1 ELSE 0 END) AS problem,
      SUM(CASE WHEN status = 'offen'   THEN 1 ELSE 0 END) AS offen
    FROM stops
    WHERE hallenliste_id = ?
  `).get(Number(hlId)) as { total: number; ok: number; problem: number; offen: number };

  // Problemgründe
  const gruende = db.prepare(`
    SELECT
      COALESCE(grund, 'Kein Grund angegeben') AS grund,
      COUNT(*) AS anzahl
    FROM stops
    WHERE hallenliste_id = ? AND status = 'problem'
    GROUP BY grund
    ORDER BY anzahl DESC
  `).all(Number(hlId)) as { grund: string; anzahl: number }[];

  // Nach Unternehmer (joined with fahrerzuordnungen for display)
  const unternehmer = db.prepare(`
    SELECT
      s.unternehmer,
      COUNT(*)                                             AS total,
      SUM(CASE WHEN s.status = 'ok'      THEN 1 ELSE 0 END) AS ok,
      SUM(CASE WHEN s.status = 'problem' THEN 1 ELSE 0 END) AS problem,
      SUM(CASE WHEN s.status = 'offen'   THEN 1 ELSE 0 END) AS offen
    FROM stops s
    WHERE s.hallenliste_id = ?
    GROUP BY s.unternehmer
    ORDER BY problem DESC, total DESC
  `).all(Number(hlId)) as { unternehmer: string; total: number; ok: number; problem: number; offen: number }[];

  // Nach Fahrer (from fahrerzuordnungen)
  const fahrer = db.prepare(`
    SELECT
      f.fahrer_name,
      f.fahrer_tel,
      f.tu AS tu_code,
      f.tu_name,
      COUNT(s.id)                                             AS total,
      SUM(CASE WHEN s.status = 'ok'      THEN 1 ELSE 0 END)  AS ok,
      SUM(CASE WHEN s.status = 'problem' THEN 1 ELSE 0 END)  AS problem,
      SUM(CASE WHEN s.status = 'offen'   THEN 1 ELSE 0 END)  AS offen
    FROM fahrerzuordnungen f
    JOIN stops s ON s.hallenliste_id = f.hallenliste_id AND s.tour = f.tour
    WHERE f.hallenliste_id = ?
    GROUP BY f.tour
    ORDER BY problem DESC, total DESC
  `).all(Number(hlId)) as {
    fahrer_name: string | null; fahrer_tel: string | null;
    tu_code: string | null;    tu_name: string | null;
    total: number; ok: number; problem: number; offen: number;
  }[];

  // Problem-Stops mit KdNr für die Bearbeitung
  const problemStops = db.prepare(`
    SELECT
      s.id, s.tour, s.unternehmer, s.art,
      s.kdnr, s.kunde, s.strasse, s.plz, s.ort,
      s.sendungen, s.grund, s.grund_freitext,
      s.erneute_zustellung, s.meldung_abrechnung,
      s.fahrer AS fahrer_manuell,
      f.fahrer_name, f.fahrer_tel
    FROM stops s
    LEFT JOIN fahrerzuordnungen f
      ON f.hallenliste_id = s.hallenliste_id AND f.tour = s.tour
    WHERE s.hallenliste_id = ? AND s.status = 'problem'
    ORDER BY s.fahrzeug, s.reihenfolge
  `).all(Number(hlId)) as {
    id: number; tour: string; unternehmer: string; art: string;
    kdnr: string | null; kunde: string | null;
    strasse: string | null; plz: string | null; ort: string | null;
    sendungen: number | null; grund: string | null; grund_freitext: string | null;
    erneute_zustellung: string | null; meldung_abrechnung: string | null;
    fahrer_manuell: string | null; fahrer_name: string | null; fahrer_tel: string | null;
  }[];

  // Auffälligkeiten: Unternehmer oder Fahrer mit Problemquote >= 20% und mindestens 3 Stops
  const auffaelligkeiten: { typ: string; name: string; quote: number; problem: number; total: number }[] = [];

  for (const u of unternehmer) {
    const quote = u.total > 0 ? u.problem / u.total : 0;
    if (quote >= 0.2 && u.total >= 3) {
      auffaelligkeiten.push({ typ: 'Unternehmer', name: u.unternehmer, quote, problem: u.problem, total: u.total });
    }
  }
  for (const f of fahrer) {
    if (!f.fahrer_name) continue;
    const quote = f.total > 0 ? f.problem / f.total : 0;
    if (quote >= 0.25 && f.total >= 2) {
      auffaelligkeiten.push({ typ: 'Fahrer', name: f.fahrer_name, quote, problem: f.problem, total: f.total });
    }
  }
  auffaelligkeiten.sort((a, b) => b.quote - a.quote);

  return NextResponse.json({ gesamt, gruende, unternehmer, fahrer, auffaelligkeiten, problemStops });
}
