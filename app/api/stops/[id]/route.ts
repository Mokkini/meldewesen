import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db   = getDb();
  const body = await req.json() as {
    status: 'ok' | 'problem' | 'offen';
    fahrer?: string;
    grund?: string;
    grund_freitext?: string;
    erneute_zustellung?: string;
    meldung_abrechnung?: string;
  };

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE stops SET
      status             = @status,
      fahrer             = @fahrer,
      grund              = @grund,
      grund_freitext     = @grund_freitext,
      erneute_zustellung = @erneute_zustellung,
      meldung_abrechnung = @meldung_abrechnung,
      bearbeitet_am      = @bearbeitet_am
    WHERE id = @id
  `).run({
    id: Number(id),
    status:             body.status,
    fahrer:             body.fahrer             ?? null,
    grund:              body.grund              ?? null,
    grund_freitext:     body.grund_freitext     ?? null,
    erneute_zustellung: body.erneute_zustellung ?? 'nein',
    meldung_abrechnung: body.meldung_abrechnung ?? 'nein',
    bearbeitet_am:      body.status !== 'offen' ? now : null,
  });

  const updated = db.prepare('SELECT * FROM stops WHERE id = ?').get(id);
  return NextResponse.json(updated);
}
