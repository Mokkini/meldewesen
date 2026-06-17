'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEPOTS, ZUSTELL_STATUS, GRUENDE } from '@/lib/constants';

const selectCls = '';

export default function NeueMeldung() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    datum: today,
    depot: '',
    tour: '',
    fahrer: '',
    unternehmer: '',
    typ: 'zusteller',
    sendungsnummer: '',
    grund: '',
    grund_freitext: '',
    erneute_zustellung: 'nein',
    meldung_abrechnung: 'nein',
    tour_abgemeldet: 'ja',
    kunde: '',
    adresse: '',
    zustell_status: '',
  });

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }
  function toggle(field: string) {
    setForm(f => ({ ...f, [field]: f[field as keyof typeof f] === 'ja' ? 'nein' : 'ja' }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.depot)          { setError('Bitte ein Depot auswählen.'); return; }
    if (!form.zustell_status) { setError('Bitte einen Zustellstatus auswählen.'); return; }
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/meldungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      router.push('/');
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <a href="/" className="back-link">← Zurück zur Übersicht</a>

      <div className="page-heading">
        <div>
          <h1>Neue Meldung erfassen</h1>
          <p>Felder mit <span style={{ color: 'var(--red)' }}>*</span> sind Pflichtfelder</p>
        </div>
      </div>

      <form onSubmit={submit}>
        {/* Section 1: Basisdaten */}
        <div className="form-section">
          <div className="form-section__title">Basisdaten</div>
          <div className="form-grid-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Datum <span className="req">*</span></label>
              <input type="date" value={form.datum} onChange={e => set('datum', e.target.value)} required />
            </div>
            <div className="field">
              <label>Depot / Standort <span className="req">*</span></label>
              <select value={form.depot} onChange={e => set('depot', e.target.value)} required className={selectCls}>
                <option value="">– bitte wählen –</option>
                {DEPOTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-3" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Tour-Nummer</label>
              <input type="text" placeholder="z. B. 1010" value={form.tour} onChange={e => set('tour', e.target.value)} />
            </div>
            <div className="field">
              <label>Fahrer</label>
              <input type="text" placeholder="Name" value={form.fahrer} onChange={e => set('fahrer', e.target.value)} />
            </div>
            <div className="field">
              <label>Unternehmer</label>
              <input type="text" placeholder="z. B. LMO, Krug…" value={form.unternehmer} onChange={e => set('unternehmer', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Art der Meldung</label>
            <div className="radio-group">
              {[
                { val: 'zusteller', label: '📦  Zusteller' },
                { val: 'abholer',   label: '↩  Abholer'   },
              ].map(({ val, label }) => (
                <label
                  key={val}
                  className={`radio-option ${form.typ === val ? 'active' : ''}`}
                  onClick={() => set('typ', val)}
                >
                  <input type="radio" name="typ" value={val} checked={form.typ === val} onChange={() => {}} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Sendung */}
        <div className="form-section">
          <div className="form-section__title">Sendungsinformationen</div>
          <div className="form-grid-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Sendungsnummer / Tchibo Kdnr.</label>
              <input type="text" placeholder="Sendungsnummer" value={form.sendungsnummer} onChange={e => set('sendungsnummer', e.target.value)} />
            </div>
            <div className="field">
              <label>Zustell-Status <span className="req">*</span></label>
              <select value={form.zustell_status} onChange={e => set('zustell_status', e.target.value)} required>
                <option value="">– bitte wählen –</option>
                {ZUSTELL_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="field">
              <label>Kunde</label>
              <input type="text" placeholder="Kundenname" value={form.kunde} onChange={e => set('kunde', e.target.value)} />
            </div>
            <div className="field">
              <label>Adresse</label>
              <input type="text" placeholder="Straße, Hausnummer" value={form.adresse} onChange={e => set('adresse', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Section 3: Grund */}
        <div className="form-section">
          <div className="form-section__title">Grund &amp; Maßnahmen</div>
          <div className="form-grid-2" style={{ marginBottom: 14 }}>
            <div className="field">
              <label>Grund (Kategorie)</label>
              <select value={form.grund} onChange={e => set('grund', e.target.value)}>
                <option value="">– bitte wählen –</option>
                {GRUENDE.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Erneute Zustellung / Abholung</label>
              <select value={form.erneute_zustellung} onChange={e => set('erneute_zustellung', e.target.value)}>
                <option value="nein">Nein</option>
                <option value="ja">Ja – neu einplanen</option>
                <option value="zusaetzlich">Ja – zusätzlich planen</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Zusatzinfos / Freitext</label>
            <textarea
              placeholder="Weitere Details zur Situation…"
              value={form.grund_freitext}
              onChange={e => set('grund_freitext', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Section 4: Abschluss */}
        <div className="form-section">
          <div className="form-section__title">Abschluss</div>
          <div className="toggle-group">
            {[
              { field: 'meldung_abrechnung', label: 'Meldung an Abrechnung' },
              { field: 'tour_abgemeldet',    label: 'Tour abgemeldet'        },
            ].map(({ field, label }) => (
              <div key={field} className="toggle-row" onClick={() => toggle(field)}>
                <button
                  type="button"
                  className={`toggle ${form[field as keyof typeof form] === 'ja' ? 'on' : ''}`}
                  aria-pressed={form[field as keyof typeof form] === 'ja'}
                >
                  <div className="toggle__knob" />
                </button>
                <span>{label}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {form[field as keyof typeof form] === 'ja' ? 'Ja' : 'Nein'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => router.back()}>
            Abbrechen
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Wird gespeichert…' : '✓ Meldung speichern'}
          </button>
        </div>
      </form>
    </div>
  );
}
