import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { ids } = await req.json() as { ids: number[] };
  if (!ids?.length) return NextResponse.json({ updated: 0 });

  const db  = getDb();
  const now = new Date().toISOString();

  const update = db.prepare(`
    UPDATE stops SET status = 'ok', bearbeitet_am = ?
    WHERE id = ? AND status = 'offen'
  `);

  const run = db.transaction(() => {
    let updated = 0;
    for (const id of ids) {
      const r = update.run(now, id);
      updated += r.changes;
    }
    return updated;
  });

  const updated = run();
  return NextResponse.json({ updated });
}
