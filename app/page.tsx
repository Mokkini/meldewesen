'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { DEPOTS, GRUENDE } from '@/lib/constants';
import type { Stop } from '@/lib/db';

// ─── Types ───────────────────────────────────────────────────────────────────

type StopWithMeta = Stop & {
  depot: string; datum: string;
  fahrer_name: string | null;
  fahrer_tel:  string | null;
};

type TourGroup = {
  fahrzeug:    string;
  tour:        string;
  unternehmer: string;
  stops:       StopWithMeta[];
  fahrer_name: string | null;
  fahrer_tel:  string | null;
};

type ArchivStop = {
  id: number; tour: string; fahrzeug: string; unternehmer: string;
  art: string; kdnr: string | null; kunde: string | null;
  strasse: string | null; plz: string | null; ort: string | null;
  sendungen: number | null; status: 'ok' | 'problem';
  fahrer_manuell: string | null; fahrer_name: string | null; fahrer_tel: string | null;
  grund: string | null; grund_freitext: string | null;
  erneute_zustellung: string | null; meldung_abrechnung: string | null;
  bearbeitet_am: string | null; depot: string; datum: string;
};

type HallenlisteEntry = {
  id: number; depot: string; datum: string; dateiname: string | null;
  fahrzeuge: number; stops_total: number; stops_ok: number;
  stops_problem: number; stops_offen: number; erstellt_am: string;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ s }: { s: string | null }) {
  if (!s) return <span className="dash">–</span>;
  const cls: Record<string, string> = {
    'zugestellt': 'badge badge--green', 'nicht zugestellt': 'badge badge--red',
    'nicht abgeholt': 'badge badge--coral', 'nicht geladen': 'badge badge--purple',
    'verspätet': 'badge badge--yellow', 'Tour-Umstellung': 'badge badge--ocean',
  };
  return <span className={cls[s] ?? 'badge badge--gray'}>{s}</span>;
}

function ProblemForm({
  stop, onSave, onCancel,
}: {
  stop: StopWithMeta;
  onSave: (data: Partial<Stop>) => void;
  onCancel: () => void;
}) {
  const [grund,      setGrund]      = useState(stop.grund      ?? '');
  const [freitext,   setFreitext]   = useState(stop.grund_freitext ?? '');
  const [fahrer,     setFahrer]     = useState(stop.fahrer     ?? '');
  const [erneute,    setErneute]    = useState(stop.erneute_zustellung ?? 'nein');
  const [abrechnung, setAbrechnung] = useState(stop.meldung_abrechnung ?? 'nein');

  return (
    <div className="problem-form">
      <div className="problem-form__grid">
        <div className="field">
          <label>Fahrer (optional)</label>
          <input type="text" placeholder="Name des Fahrers" value={fahrer} onChange={e => setFahrer(e.target.value)} />
        </div>
        <div className="field">
          <label>Grund <span className="req">*</span></label>
          <select value={grund} onChange={e => setGrund(e.target.value)}>
            <option value="">– bitte wählen –</option>
            {GRUENDE.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Zusatzinfos</label>
          <textarea
            rows={2}
            placeholder="Weitere Details…"
            value={freitext}
            onChange={e => setFreitext(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Erneute Zustellung</label>
          <select value={erneute} onChange={e => setErneute(e.target.value)}>
            <option value="nein">Nein</option>
            <option value="ja">Ja – neu einplanen</option>
            <option value="zusaetzlich">Ja – zusätzlich planen</option>
          </select>
        </div>
        <div className="field" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
          <label className="toggle-row" style={{ cursor: 'pointer' }}
            onClick={() => setAbrechnung(v => v === 'ja' ? 'nein' : 'ja')}>
            <button type="button"
              className={`toggle ${abrechnung === 'ja' ? 'on' : ''}`}>
              <div className="toggle__knob" />
            </button>
            <span>Meldung an Abrechnung</span>
          </label>
        </div>
      </div>
      <div className="problem-form__actions">
        <button className="btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onCancel}>
          Abbrechen
        </button>
        <button
          className="btn-primary"
          style={{ fontSize: 12, padding: '5px 14px', background: 'var(--lmo-coral)' }}
          onClick={() => onSave({ grund: grund || 'Sonstiges', grund_freitext: freitext || null, fahrer: fahrer || null, erneute_zustellung: erneute, meldung_abrechnung: abrechnung })}
        >
          ✗ Als Problem speichern
        </button>
      </div>
    </div>
  );
}

function StopRow({ stop, onUpdate }: { stop: StopWithMeta; onUpdate: (id: number, data: Partial<Stop>) => void }) {
  const [showForm, setShowForm] = useState(false);

  const adresse = [stop.strasse, stop.plz && stop.ort ? `${stop.plz} ${stop.ort}` : stop.ort].filter(Boolean).join(', ');
  const artIcon = stop.art === 'Abholung' ? '↩' : '📦';

  async function setOk() {
    onUpdate(stop.id, { status: 'ok' });
  }

  async function saveProblem(data: Partial<Stop>) {
    onUpdate(stop.id, { status: 'problem', ...data });
    setShowForm(false);
  }

  return (
    <div className={`stop-row stop-row--${stop.status}`}>
      <div className="stop-row__main">
        <span className="stop-row__time">{stop.zeit ?? '–'}</span>
        <span className={`stop-row__art ${stop.art === 'Abholung' ? 'stop-row__art--abholung' : ''}`}>
          {artIcon} {stop.art}
        </span>
        <div className="stop-row__info">
          <span className="stop-row__kunde">{stop.kunde ?? '–'}</span>
          {adresse && <span className="stop-row__adresse">{adresse}</span>}
        </div>
        {stop.sendungen && <span className="stop-row__sdg">{stop.sendungen} Sdg.</span>}

        {/* Actions */}
        <div className="stop-row__actions">
          {stop.status === 'offen' && (
            <>
              <button className="btn-stop-ok" onClick={setOk} title="Zugestellt / OK">
                ✓ OK
              </button>
              <button className="btn-stop-problem" onClick={() => setShowForm(v => !v)} title="Problem melden">
                ✗ Problem
              </button>
            </>
          )}
          {stop.status === 'ok' && (
            <span className="stop-status-ok">✓ Zugestellt</span>
          )}
          {stop.status === 'problem' && (
            <div className="stop-status-problem">
              <span>✗ {stop.grund ?? 'Problem'}</span>
              {stop.grund_freitext && <span className="stop-status-problem__detail">{stop.grund_freitext}</span>}
            </div>
          )}
          {stop.status !== 'offen' && (
            <button
              className="btn-undo"
              onClick={() => onUpdate(stop.id, { status: 'offen', grund: undefined, grund_freitext: undefined })}
              title="Zurücksetzen"
            >↩</button>
          )}
        </div>
      </div>

      {showForm && (
        <ProblemForm stop={stop} onSave={saveProblem} onCancel={() => setShowForm(false)} />
      )}
    </div>
  );
}

function TourCard({ group, onUpdate, onBulkOk }: {
  group: TourGroup;
  onUpdate: (id: number, data: Partial<Stop>) => void;
  onBulkOk: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const total   = group.stops.length;
  const ok      = group.stops.filter(s => s.status === 'ok').length;
  const problem = group.stops.filter(s => s.status === 'problem').length;
  const offen   = group.stops.filter(s => s.status === 'offen').length;
  const done    = ok + problem;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = offen === 0;

  function handleAlleOk(e: React.MouseEvent) {
    e.stopPropagation();
    const offeneIds = group.stops.filter(s => s.status === 'offen').map(s => s.id);
    if (offeneIds.length === 0) return;
    if (!confirm(`Alle ${offeneIds.length} offenen Stops von Tour ${group.tour} als OK markieren?`)) return;
    onBulkOk(offeneIds);
  }

  return (
    <div className={`tour-card ${allDone ? 'tour-card--done' : ''}`}>
      <div className="tour-header" onClick={() => setOpen(v => !v)}>
        <div className="tour-header__left">
          <span className="tour-header__toggle">{open ? '▾' : '▸'}</span>
          <span className="tour-header__nr">Tour {group.tour}</span>
          <span className="tour-header__unt">{group.unternehmer}</span>
          {(group.fahrer_name || group.fahrer_tel) && (
            <div className="tour-header__fahrer" onClick={e => e.stopPropagation()}>
              {group.fahrer_name && (
                <span className="tour-header__fahrer-name">👤 {group.fahrer_name}</span>
              )}
              {group.fahrer_tel && (
                <a
                  href={`tel:${group.fahrer_tel.replace(/\s/g, '')}`}
                  className="tour-header__fahrer-tel"
                  title={`Anrufen: ${group.fahrer_tel}`}
                >
                  📞 {group.fahrer_tel}
                </a>
              )}
            </div>
          )}
        </div>
        <div className="tour-header__progress">
          <div className="tour-progress-bar">
            <div
              className="tour-progress-bar__fill"
              style={{ width: `${pct}%`, background: problem > 0 ? 'var(--lmo-coral)' : 'var(--lmo-ocean)' }}
            />
          </div>
          <span className="tour-header__stats">
            {ok > 0      && <span className="stat-ok">✓ {ok}</span>}
            {problem > 0 && <span className="stat-prob">✗ {problem}</span>}
            {offen > 0   && <span className="stat-offen">{offen} offen</span>}
          </span>
          <span className="tour-header__count">{total} Stops</span>
          {offen > 0 && (
            <button className="btn-alle-ok" onClick={handleAlleOk} title="Alle offenen Stops als OK markieren">
              ✓ Alle OK
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="tour-body">
          {group.stops.map(s => (
            <StopRow key={s.id} stop={s} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

// ─── Types for Auswertung ────────────────────────────────────────────────────

type ProblemStop = {
  id: number; tour: string; unternehmer: string; art: string;
  kdnr: string | null; kunde: string | null;
  strasse: string | null; plz: string | null; ort: string | null;
  sendungen: number | null; grund: string | null; grund_freitext: string | null;
  erneute_zustellung: string | null; meldung_abrechnung: string | null;
  fahrer_manuell: string | null; fahrer_name: string | null; fahrer_tel: string | null;
};

type AuswertungData = {
  gesamt: { total: number; ok: number; problem: number; offen: number };
  gruende: { grund: string; anzahl: number }[];
  unternehmer: { unternehmer: string; total: number; ok: number; problem: number; offen: number }[];
  fahrer: {
    fahrer_name: string | null; fahrer_tel: string | null;
    tu_code: string | null; tu_name: string | null;
    total: number; ok: number; problem: number; offen: number;
  }[];
  auffaelligkeiten: { typ: string; name: string; quote: number; problem: number; total: number }[];
  problemStops: ProblemStop[];
};

// ─── Auswertung Tab ───────────────────────────────────────────────────────────

const S = {
  section: {
    background: '#fff', border: '1px solid #d5e4ea', borderRadius: 10,
    padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '.7px', color: '#00A3CB', borderBottom: '1px solid #d5e4ea',
    paddingBottom: 10, marginBottom: 14,
  } as React.CSSProperties,
  th: {
    background: 'transparent', color: '#5f7a87', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '.5px',
    padding: '4px 10px 8px', textAlign: 'left' as const,
    borderBottom: '1px solid #d5e4ea',
  } as React.CSSProperties,
  td: { padding: '8px 10px', borderBottom: '1px solid #f1f3f5', fontSize: 13 } as React.CSSProperties,
};

function PctBadge({ pct, warn }: { pct: number; warn: boolean }) {
  const style: React.CSSProperties = {
    display: 'inline-block', padding: '2px 9px', borderRadius: 999,
    fontSize: 11, fontWeight: 700,
    background: warn ? '#fce7e9' : pct === 0 ? '#d1fae5' : '#f1f5f9',
    color:      warn ? '#D25A64' : pct === 0 ? '#065f46' : '#5f7a87',
  };
  return <span style={style}>{pct.toFixed(0)}%</span>;
}

function AuswertungTab({ hallenlisteId, hlData }: {
  hallenlisteId: number;
  hlData: HallenlisteEntry;
}) {
  const [data,    setData]    = useState<AuswertungData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/auswertung?hallenliste_id=${hallenlisteId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); });
  }, [hallenlisteId]);

  if (loading) return <div className="loading">Lade Auswertung…</div>;
  if (!data)   return null;

  const { gesamt, gruende, unternehmer, fahrer, auffaelligkeiten, problemStops } = data;
  const problemPct = gesamt.total > 0 ? (gesamt.problem / gesamt.total) * 100 : 0;
  const okPct      = gesamt.total > 0 ? (gesamt.ok      / gesamt.total) * 100 : 0;
  const maxGrund   = gruende[0]?.anzahl ?? 1;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#006784' }}>Tagesauswertung</h2>
        <p style={{ fontSize: 13, color: '#5f7a87', marginTop: 2 }}>{hlData.datum} · {hlData.depot}</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {/* Gesamt */}
        <div style={{ background: '#fff', border: '1px solid #d5e4ea', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#006784', lineHeight: 1, marginBottom: 4 }}>{gesamt.total}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5f7a87', textTransform: 'uppercase', letterSpacing: '.5px' }}>Stops gesamt</div>
        </div>
        {/* Zugestellt */}
        <div style={{ background: '#fff', border: '1px solid #d5e4ea', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#16a34a', lineHeight: 1, marginBottom: 4 }}>{gesamt.ok}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5f7a87', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            Zugestellt · {okPct.toFixed(1)}%
          </div>
          <div style={{ height: 5, background: '#e8eef1', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${okPct}%`, background: '#00A3CB', borderRadius: 99, transition: 'width .4s ease' }} />
          </div>
        </div>
        {/* Probleme */}
        <div style={{ background: '#fff', border: '1px solid #d5e4ea', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#D25A64', lineHeight: 1, marginBottom: 4 }}>{gesamt.problem}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5f7a87', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
            Probleme · {problemPct.toFixed(1)}%
          </div>
          <div style={{ height: 5, background: '#e8eef1', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${problemPct}%`, background: '#D25A64', borderRadius: 99, transition: 'width .4s ease' }} />
          </div>
        </div>
        {/* Offen */}
        <div style={{ background: '#fff', border: '1px solid #d5e4ea', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: '#00A3CB', lineHeight: 1, marginBottom: 4 }}>{gesamt.offen}</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#5f7a87', textTransform: 'uppercase', letterSpacing: '.5px' }}>Noch offen</div>
        </div>
      </div>

      {/* Problem-Stops zur Bearbeitung */}
      {problemStops.length > 0 && (
        <div style={{ ...S.section, marginBottom: 16, borderLeft: '4px solid #D25A64' }}>
          <div style={{ ...S.sectionTitle, color: '#D25A64' }}>
            ✗ Probleme zur Nachbearbeitung – {problemStops.length} Stop{problemStops.length !== 1 ? 's' : ''}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Tour', 'KdNr.', 'Kunde', 'Adresse', 'Sdg.', 'Fahrer', 'Grund', 'Erneut', 'Abr.'].map(h => (
                    <th key={h} style={{ ...S.th, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {problemStops.map((p, i) => {
                  const fahrer = p.fahrer_name ?? p.fahrer_manuell;
                  const adresse = [p.strasse, p.plz && p.ort ? `${p.plz} ${p.ort}` : p.ort].filter(Boolean).join(', ');
                  const grund = p.grund_freitext || p.grund || '–';
                  return (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? '#fff' : '#fdf8f8' }}>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 700, color: '#006784' }}>{p.tour}</span>
                        <span style={{ fontSize: 10, color: '#5f7a87', marginLeft: 4 }}>{p.unternehmer}</span>
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12, color: '#006784', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {p.kdnr ?? <span style={{ color: '#d1d5db' }}>–</span>}
                      </td>
                      <td style={{ ...S.td, fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={p.kunde ?? ''}>
                        {p.kunde ?? '–'}
                      </td>
                      <td style={{ ...S.td, color: '#5f7a87', fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={adresse}>
                        {adresse || '–'}
                      </td>
                      <td style={{ ...S.td, color: '#5f7a87', textAlign: 'center' }}>{p.sendungen ?? '–'}</td>
                      <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                        {fahrer
                          ? <span>{fahrer}{p.fahrer_tel && <a href={`tel:${p.fahrer_tel.replace(/\s/g, '')}`} style={{ marginLeft: 6, color: '#00A3CB', fontSize: 11 }}>📞</a>}</span>
                          : <span style={{ color: '#d1d5db' }}>–</span>
                        }
                      </td>
                      <td style={{ ...S.td, color: '#D25A64', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={grund}>
                        {grund}
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        {p.erneute_zustellung && p.erneute_zustellung !== 'nein'
                          ? <span style={{ color: '#006784', fontWeight: 700, fontSize: 11 }}>✓</span>
                          : <span style={{ color: '#d1d5db' }}>–</span>
                        }
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        {p.meldung_abrechnung === 'ja'
                          ? <span style={{ color: '#D25A64', fontWeight: 700 }}>✓</span>
                          : <span style={{ color: '#d1d5db' }}>–</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Auffälligkeiten */}
      {auffaelligkeiten.length > 0 && (
        <div style={{ ...S.section, marginBottom: 16 }}>
          <div style={S.sectionTitle}>⚠ Auffälligkeiten</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {auffaelligkeiten.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                background: '#fff8e6', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px',
                  background: a.typ === 'Fahrer' ? '#00A3CB' : '#006784', color: '#fff',
                  padding: '2px 8px', borderRadius: 4,
                }}>{a.typ}</span>
                <span style={{ fontWeight: 700, color: '#1a2e38' }}>{a.name}</span>
                <span style={{ color: '#5f7a87', fontSize: 12, flex: 1 }}>
                  {a.problem} von {a.total} Stops mit Problem
                </span>
                <span style={{ fontWeight: 700, color: '#D25A64', fontSize: 13 }}>
                  {(a.quote * 100).toFixed(0)}% Problemquote
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid: Problemgründe + Unternehmer */}
      <div style={{ display: 'grid', gridTemplateColumns: gruende.length > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>

        {/* Problemgründe */}
        {gruende.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Problemgründe</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {gruende.map(g => (
                <div key={g.grund} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: '#1a2e38', minWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {g.grund}
                  </span>
                  <div style={{ flex: 1, height: 8, background: '#e8eef1', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(g.anzahl / maxGrund) * 100}%`, background: '#D25A64', borderRadius: 99 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#D25A64', minWidth: 28, textAlign: 'right' }}>{g.anzahl}×</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nach Unternehmer */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Nach Unternehmer</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {['Unternehmer','Stops','OK','Probleme','Quote'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {unternehmer.map(u => {
                const q = u.total > 0 ? (u.problem / u.total) * 100 : 0;
                return (
                  <tr key={u.unternehmer} style={{ background: q >= 20 ? '#fff8e6' : 'transparent' }}>
                    <td style={{ ...S.td, fontWeight: 600 }}>{u.unternehmer}</td>
                    <td style={{ ...S.td, color: '#5f7a87', textAlign: 'right' }}>{u.total}</td>
                    <td style={{ ...S.td, color: '#16a34a', fontWeight: 600, textAlign: 'right' }}>{u.ok}</td>
                    <td style={{ ...S.td, color: u.problem > 0 ? '#D25A64' : '#5f7a87', fontWeight: u.problem > 0 ? 600 : 400, textAlign: 'right' }}>
                      {u.problem > 0 ? u.problem : '–'}
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}><PctBadge pct={q} warn={q >= 20} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nach Fahrer */}
      {fahrer.some(f => f.fahrer_name) && (
        <div style={S.section}>
          <div style={S.sectionTitle}>Nach Fahrer</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Fahrer','Unternehmer','Telefon','Stops','OK','Probleme','Quote'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fahrer.map((f, i) => {
                  const q = f.total > 0 ? (f.problem / f.total) * 100 : 0;
                  return (
                    <tr key={i} style={{ background: q >= 25 ? '#fff8e6' : i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                      <td style={{ ...S.td, fontWeight: 600 }}>{f.fahrer_name ?? '–'}</td>
                      <td style={S.td}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#006784', background: 'rgba(0,103,132,.1)', padding: '2px 7px', borderRadius: 4 }}>
                          {f.tu_name ?? f.tu_code ?? '–'}
                        </span>
                      </td>
                      <td style={S.td}>
                        {f.fahrer_tel
                          ? <a href={`tel:${f.fahrer_tel.replace(/\s/g, '')}`}
                              style={{ color: '#00A3CB', textDecoration: 'none', fontSize: 12 }}>
                              {f.fahrer_tel}
                            </a>
                          : <span style={{ color: '#d1d5db' }}>–</span>
                        }
                      </td>
                      <td style={{ ...S.td, color: '#5f7a87', textAlign: 'right' }}>{f.total}</td>
                      <td style={{ ...S.td, color: '#16a34a', fontWeight: 600, textAlign: 'right' }}>{f.ok}</td>
                      <td style={{ ...S.td, color: f.problem > 0 ? '#D25A64' : '#5f7a87', fontWeight: f.problem > 0 ? 600 : 400, textAlign: 'right' }}>
                        {f.problem > 0 ? f.problem : '–'}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}><PctBadge pct={q} warn={q >= 25} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [tab, setTab] = useState<'touren' | 'archiv' | 'auswertung'>('touren');

  // Touren-Tab state
  const [stops,         setStops]         = useState<StopWithMeta[]>([]);
  const [hallenlisten,  setHallenlisten]  = useState<HallenlisteEntry[]>([]);
  const [selectedHl,    setSelectedHl]    = useState<number | null>(null);
  const [loadingStops,  setLoadingStops]  = useState(false);

  // Archiv-Tab state
  const [archivRows,   setArchivRows]   = useState<ArchivStop[]>([]);
  const [loadingMeld,  setLoadingMeld]  = useState(false);
  const [depot,        setDepot]        = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [von,          setVon]          = useState('');
  const [bis,          setBis]          = useState('');
  const [search,       setSearch]       = useState('');

  // Load Hallenlisten list
  const loadHallenlisten = useCallback(async () => {
    const res  = await fetch('/api/hallenlisten');
    const data = await res.json() as HallenlisteEntry[];
    setHallenlisten(data);
    if (data.length > 0 && selectedHl === null) {
      setSelectedHl(data[0].id);
    }
  }, [selectedHl]);

  // Load stops for selected Hallenliste
  const loadStops = useCallback(async () => {
    if (!selectedHl) { setStops([]); return; }
    setLoadingStops(true);
    const res  = await fetch(`/api/stops?hallenliste_id=${selectedHl}`);
    const data = await res.json() as StopWithMeta[];
    setStops(data);
    setLoadingStops(false);
  }, [selectedHl]);

  // Load Archiv (processed stops)
  const loadArchiv = useCallback(async () => {
    setLoadingMeld(true);
    const p = new URLSearchParams();
    if (depot)        p.set('depot',  depot);
    if (filterStatus) p.set('status', filterStatus);
    if (von)          p.set('von',    von);
    if (bis)          p.set('bis',    bis);
    if (search)       p.set('search', search);
    const res = await fetch(`/api/archiv?${p}`);
    setArchivRows(await res.json());
    setLoadingMeld(false);
  }, [depot, filterStatus, von, bis, search]);

  useEffect(() => { loadHallenlisten(); }, []);
  useEffect(() => { if (tab === 'touren') loadStops(); }, [tab, selectedHl]);
  useEffect(() => { if (tab === 'archiv') loadArchiv(); }, [tab, depot, filterStatus, von, bis, search]);

  // Update single stop status
  async function updateStop(id: number, data: Partial<Stop>) {
    await fetch(`/api/stops/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setStops(prev => prev.map(s => s.id === id ? { ...s, ...data } as StopWithMeta : s));
  }

  // Bulk mark all open stops of a tour as OK
  async function bulkOk(ids: number[]) {
    const now = new Date().toISOString();
    await fetch('/api/stops/bulk-ok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    setStops(prev => prev.map(s =>
      ids.includes(s.id) && s.status === 'offen'
        ? { ...s, status: 'ok' as const, bearbeitet_am: now }
        : s
    ));
  }


  // Group stops by tour
  const tourGroups: TourGroup[] = [];
  const tourMap = new Map<string, TourGroup>();
  for (const s of stops) {
    if (!tourMap.has(s.fahrzeug)) {
      const g: TourGroup = {
        fahrzeug:    s.fahrzeug,
        tour:        s.tour,
        unternehmer: s.unternehmer,
        stops:       [],
        fahrer_name: s.fahrer_name ?? null,
        fahrer_tel:  s.fahrer_tel  ?? null,
      };
      tourMap.set(s.fahrzeug, g);
      tourGroups.push(g);
    }
    tourMap.get(s.fahrzeug)!.stops.push(s);
  }

  // Touren stats
  const totalStops   = stops.length;
  const okStops      = stops.filter(s => s.status === 'ok').length;
  const problemStops = stops.filter(s => s.status === 'problem').length;
  const offenStops   = stops.filter(s => s.status === 'offen').length;

  const selectedHlData = hallenlisten.find(h => h.id === selectedHl);

  return (
    <>
      {/* Tab bar */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'touren' ? 'tab-btn--active' : ''}`}
          onClick={() => setTab('touren')}
        >
          🚛 Touren abarbeiten
        </button>
        <button
          className={`tab-btn ${tab === 'archiv' ? 'tab-btn--active' : ''}`}
          onClick={() => setTab('archiv')}
        >
          📋 Meldungsarchiv
        </button>
        <button
          className={`tab-btn ${tab === 'auswertung' ? 'tab-btn--active' : ''}`}
          onClick={() => setTab('auswertung')}
        >
          📊 Auswertung
        </button>
        <div style={{ flex: 1 }} />
        <Link href="/upload" className="btn-primary" style={{ fontSize: 13, padding: '6px 14px' }}>
          ↑ Listen hochladen
        </Link>
        <Link href="/neu" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>
          + Manuell
        </Link>
      </div>

      {/* ── TOUREN TAB ── */}
      {tab === 'touren' && (
        <div>
          {hallenlisten.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              <div className="empty-state__icon">📂</div>
              <p style={{ fontWeight: 600, color: 'var(--lmo-pine)' }}>Noch keine Hallenliste geladen</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                Der Disponent lädt die Liste jeden Abend hoch.
              </p>
              <Link href="/upload" className="btn-primary" style={{ marginTop: 16 }}>
                ↑ Hallenliste jetzt hochladen
              </Link>
            </div>
          ) : (
            <>
              {/* Hallenliste selector + stats */}
              <div className="hl-selector-bar">
                <div className="field" style={{ flex: 1, maxWidth: 420 }}>
                  <label>Aktive Hallenliste</label>
                  <select
                    value={selectedHl ?? ''}
                    onChange={e => setSelectedHl(Number(e.target.value))}
                  >
                    {hallenlisten.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.datum} · {h.depot.split('–')[1]?.trim() ?? h.depot} · {h.fahrzeuge} Touren
                      </option>
                    ))}
                  </select>
                </div>
                {selectedHlData && (
                  <div className="hl-stats">
                    <div className="hl-stat hl-stat--ok">
                      <span className="hl-stat__val">{selectedHlData.stops_ok}</span>
                      <span className="hl-stat__label">OK</span>
                    </div>
                    <div className="hl-stat hl-stat--prob">
                      <span className="hl-stat__val">{selectedHlData.stops_problem}</span>
                      <span className="hl-stat__label">Probleme</span>
                    </div>
                    <div className="hl-stat hl-stat--offen">
                      <span className="hl-stat__val">{selectedHlData.stops_offen}</span>
                      <span className="hl-stat__label">Offen</span>
                    </div>
                    <div className="hl-stat">
                      <span className="hl-stat__val">{selectedHlData.stops_total}</span>
                      <span className="hl-stat__label">Gesamt</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Global progress bar */}
              {totalStops > 0 && (
                <div className="global-progress">
                  <div className="global-progress__bar">
                    <div
                      className="global-progress__fill global-progress__fill--ok"
                      style={{ width: `${(okStops / totalStops) * 100}%` }}
                    />
                    <div
                      className="global-progress__fill global-progress__fill--prob"
                      style={{ width: `${(problemStops / totalStops) * 100}%`, left: `${(okStops / totalStops) * 100}%` }}
                    />
                  </div>
                  <span className="global-progress__label">
                    {okStops + problemStops} / {totalStops} Stops bearbeitet
                    ({offenStops} offen)
                  </span>
                </div>
              )}

              {/* Tour cards */}
              {loadingStops ? (
                <div className="loading">Lade Touren…</div>
              ) : tourGroups.length === 0 ? (
                <div className="empty-state"><p>Keine Stops gefunden.</p></div>
              ) : (
                <div className="tour-list">
                  {tourGroups.map(g => (
                    <TourCard key={g.fahrzeug} group={g} onUpdate={updateStop} onBulkOk={bulkOk} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ARCHIV TAB ── */}
      {tab === 'archiv' && (
        <div>
          <div className="filter-bar" style={{ marginTop: 0 }}>
            <span className="filter-bar__label">Filter:</span>
            <input type="text" className="filter-search" placeholder="Fahrer, Tour, Kunde, KdNr…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select value={depot} onChange={e => setDepot(e.target.value)}>
              <option value="">Alle Depots</option>
              {DEPOTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">OK + Probleme</option>
              <option value="ok">Nur OK</option>
              <option value="problem">Nur Probleme</option>
            </select>
            <div className="date-range">
              <input type="date" value={von} onChange={e => setVon(e.target.value)} />
              <span>–</span>
              <input type="date" value={bis} onChange={e => setBis(e.target.value)} />
            </div>
            {(depot || filterStatus || von || bis || search) && (
              <button className="filter-reset" onClick={() => {
                setDepot(''); setFilterStatus(''); setVon(''); setBis(''); setSearch('');
              }}>✕ Zurücksetzen</button>
            )}
          </div>

          <div className="table-wrap">
            {loadingMeld ? (
              <div className="loading">Lade Archiv…</div>
            ) : archivRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__icon">📭</div>
                <p>Keine abgearbeiteten Stops gefunden</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Stops erscheinen hier sobald sie im Touren-Tab als OK oder Problem markiert wurden.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Tour</th>
                      <th>Fahrer</th>
                      <th>Kunde</th>
                      <th>Adresse</th>
                      <th>Sdg.</th>
                      <th>Status</th>
                      <th>Grund</th>
                      <th style={{ textAlign: 'center' }}>Abr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivRows.map(r => {
                      const fahrer = r.fahrer_name ?? r.fahrer_manuell;
                      const adresse = [r.strasse, r.plz && r.ort ? `${r.plz} ${r.ort}` : r.ort].filter(Boolean).join(', ');
                      return (
                        <tr key={r.id}>
                          <td className="muted" style={{ whiteSpace: 'nowrap' }}>{r.datum}</td>
                          <td>
                            <span className="depot-tag" style={{ marginRight: 4 }}>{r.tour}</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.unternehmer}</span>
                          </td>
                          <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{fahrer ?? '–'}</td>
                          <td className="truncate" title={r.kunde ?? ''}>{r.kunde ?? '–'}</td>
                          <td className="truncate muted" title={adresse}>{adresse || '–'}</td>
                          <td className="muted" style={{ textAlign: 'center' }}>{r.sendungen ?? '–'}</td>
                          <td>
                            {r.status === 'ok'
                              ? <span style={{ color: '#16a34a', fontWeight: 700, fontSize: 12 }}>✓ OK</span>
                              : <span style={{ color: '#D25A64', fontWeight: 700, fontSize: 12 }}>✗ Problem</span>
                            }
                          </td>
                          <td className="truncate muted" style={{ maxWidth: 180 }}
                            title={r.grund_freitext || r.grund || ''}>
                            {r.grund_freitext || r.grund || '–'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {r.meldung_abrechnung === 'ja'
                              ? <span className="check">✓</span>
                              : <span className="dash">–</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="table-footer">
                  <span>{archivRows.length} Einträge · {archivRows.filter(r => r.status === 'problem').length} Probleme</span>
                  <span>{new Date().toLocaleString('de-DE')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── AUSWERTUNG TAB ── */}
      {tab === 'auswertung' && (
        <div>
          {hallenlisten.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 60 }}>
              <div className="empty-state__icon">📊</div>
              <p style={{ fontWeight: 600, color: 'var(--lmo-pine)' }}>Noch keine Daten vorhanden</p>
              <Link href="/upload" className="btn-primary" style={{ marginTop: 16 }}>
                ↑ Listen hochladen
              </Link>
            </div>
          ) : (
            <>
              <div className="hl-selector-bar">
                <div className="field" style={{ flex: 1, maxWidth: 420 }}>
                  <label>Hallenliste auswählen</label>
                  <select
                    value={selectedHl ?? ''}
                    onChange={e => setSelectedHl(Number(e.target.value))}
                  >
                    {hallenlisten.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.datum} · {h.depot.split('–')[1]?.trim() ?? h.depot} · {h.fahrzeuge} Touren
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedHl && selectedHlData && (
                <AuswertungTab hallenlisteId={selectedHl} hlData={selectedHlData} />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
