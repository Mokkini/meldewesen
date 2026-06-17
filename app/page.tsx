'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type QuickStats = {
  hallenlisten: number;
  datum: string | null;
  depot: string | null;
  stops_total: number;
  stops_ok: number;
  stops_problem: number;
  stops_offen: number;
} | null;

export default function StartPage() {
  const [stats, setStats] = useState<QuickStats>(null);

  useEffect(() => {
    fetch('/api/hallenlisten')
      .then(r => r.json())
      .then((data: { id: number; datum: string; depot: string; stops_total: number; stops_ok: number; stops_problem: number; stops_offen: number }[]) => {
        if (!data.length) return;
        const latest = data[0];
        setStats({
          hallenlisten: data.length,
          datum:         latest.datum,
          depot:         latest.depot,
          stops_total:   latest.stops_total,
          stops_ok:      latest.stops_ok,
          stops_problem: latest.stops_problem,
          stops_offen:   latest.stops_offen,
        });
      });
  }, []);

  const pctOk = stats && stats.stops_total > 0
    ? Math.round((stats.stops_ok / stats.stops_total) * 100)
    : 0;

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #006784 0%, #00A3CB 100%)',
        borderRadius: 14, padding: '40px 44px', marginBottom: 32, color: '#fff',
        boxShadow: '0 4px 24px rgba(0,103,132,.25)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', opacity: .75, marginBottom: 10 }}>
          Last Mile Optimizer · Internes Tool
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.2 }}>
          Meldewesen – Callcenter
        </h1>
        <p style={{ fontSize: 15, opacity: .9, lineHeight: 1.65, maxWidth: 520, margin: 0 }}>
          Das Callcenter ruft jeden Morgen die Fahrer an und erfasst hier, ob alle Stopps
          zugestellt wurden. Probleme werden mit Grund und Kundennummer dokumentiert.
        </p>
      </div>

      {/* Heute-Widget */}
      {stats && (
        <div style={{
          background: '#fff', border: '1px solid #d5e4ea', borderRadius: 12,
          padding: '20px 24px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: '#5f7a87', marginBottom: 4 }}>
                Aktuelle Liste
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#006784' }}>
                {stats.datum} · {stats.depot?.split('–')[1]?.trim() ?? stats.depot}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{stats.stops_ok}</div>
                <div style={{ fontSize: 10, color: '#5f7a87', fontWeight: 600, textTransform: 'uppercase' }}>OK</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#D25A64', lineHeight: 1 }}>{stats.stops_problem}</div>
                <div style={{ fontSize: 10, color: '#5f7a87', fontWeight: 600, textTransform: 'uppercase' }}>Probleme</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#00A3CB', lineHeight: 1 }}>{stats.stops_offen}</div>
                <div style={{ fontSize: 10, color: '#5f7a87', fontWeight: 600, textTransform: 'uppercase' }}>Offen</div>
              </div>
              <div style={{ width: 80 }}>
                <div style={{ height: 6, background: '#e8eef1', borderRadius: 99, overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ height: '100%', width: `${pctOk}%`, background: '#00A3CB', borderRadius: 99 }} />
                </div>
                <div style={{ fontSize: 11, color: '#5f7a87', textAlign: 'center' }}>{pctOk}% erledigt</div>
              </div>
            </div>
            <Link href="/dashboard" style={{
              background: '#00A3CB', color: '#fff', textDecoration: 'none',
              padding: '10px 22px', borderRadius: 8, fontWeight: 700, fontSize: 14,
              whiteSpace: 'nowrap',
            }}>
              Weiter abarbeiten →
            </Link>
          </div>
        </div>
      )}

      {/* Workflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 28 }}>
        {[
          {
            step: '1',
            icon: '📋',
            title: 'Listen hochladen',
            text: 'Hallenliste und Dispoplan werden hochgeladen. Touren, Stopps, Fahrer und Telefonnummern sind dann automatisch hinterlegt.',
            link: '/upload',
            linkLabel: 'Listen hochladen',
            color: '#006784',
          },
          {
            step: '2',
            icon: '📞',
            title: 'Stopps abarbeiten',
            text: 'Die Fahrer werden angerufen und pro Stopp wird "OK" oder "Problem" gesetzt. Bei einem Problem werden Grund und Kundennummer erfasst.',
            link: '/dashboard',
            linkLabel: 'Touren abarbeiten',
            color: '#00A3CB',
          },
          {
            step: '3',
            icon: '📊',
            title: 'Auswertung & Nachbearbeitung',
            text: 'Die Tagesauswertung zeigt Problemquoten je Fahrer und Unternehmer. Alle Problem-Stopps mit KdNr sind direkt zur Nachbearbeitung aufgelistet.',
            link: '/dashboard',
            linkLabel: 'Zur Auswertung',
            color: '#D25A64',
          },
        ].map(s => (
          <div key={s.step} style={{
            background: '#fff', border: '1px solid #d5e4ea', borderRadius: 12,
            padding: '22px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                background: s.color, color: '#fff', width: 26, height: 26,
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0,
              }}>{s.step}</span>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1a2e38', lineHeight: 1.3 }}>{s.title}</div>
            <div style={{ fontSize: 12, color: '#5f7a87', lineHeight: 1.6, flex: 1 }}>{s.text}</div>
            <Link href={s.link} style={{
              color: s.color, fontWeight: 700, fontSize: 12, textDecoration: 'none',
              borderTop: '1px solid #f0f4f7', paddingTop: 10, marginTop: 4,
            }}>
              {s.linkLabel} →
            </Link>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', paddingBottom: 8 }}>
        <Link href="/dashboard" style={{
          background: '#00A3CB', color: '#fff', textDecoration: 'none',
          padding: '11px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14,
        }}>
          🚛 Touren abarbeiten
        </Link>
        <Link href="/upload" style={{
          background: '#fff', color: '#1a2e38', textDecoration: 'none',
          padding: '11px 28px', borderRadius: 8, fontWeight: 600, fontSize: 14,
          border: '1px solid #d5e4ea',
        }}>
          ↑ Listen hochladen
        </Link>
        <Link href="/dashboard" style={{
          background: '#fff', color: '#1a2e38', textDecoration: 'none',
          padding: '11px 28px', borderRadius: 8, fontWeight: 600, fontSize: 14,
          border: '1px solid #d5e4ea',
        }}>
          📊 Auswertung
        </Link>
      </div>
    </div>
  );
}
