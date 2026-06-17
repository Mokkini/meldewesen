'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DEPOTS } from '@/lib/constants';

type HlEntry = { id: number; depot: string; datum: string; dateiname: string | null };

// ─── Hallenliste upload ───────────────────────────────────────────────────────

function HallenlisteUpload({ onSuccess }: { onSuccess: () => void }) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const today   = new Date().toISOString().split('T')[0];

  const [file,    setFile]    = useState<File | null>(null);
  const [depot,   setDepot]   = useState('');
  const [datum,   setDatum]   = useState(today);
  const [drag,    setDrag]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ touren: number; stops: number } | null>(null);
  const [error,   setError]   = useState('');

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function upload() {
    if (!file)  { setError('Bitte eine Datei auswählen.'); return; }
    if (!depot) { setError('Bitte ein Depot auswählen.'); return; }
    setError('');
    setLoading(true);

    const fd = new FormData();
    fd.append('file',  file);
    fd.append('depot', depot);
    fd.append('datum', datum);

    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Upload');
      setResult({ touren: data.touren, stops: data.stops });
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="upload-success">
        <div className="upload-success__icon">✅</div>
        <h3>Hallenliste importiert</h3>
        <p>
          <strong>{result.touren} Touren</strong> mit{' '}
          <strong>{result.stops} Stops</strong> wurden geladen.
        </p>
        <div className="upload-success__actions">
          <button className="btn-primary" onClick={() => router.push('/')}>Zum Dashboard →</button>
          <button className="btn-secondary" onClick={() => { setResult(null); setFile(null); }}>
            Weitere Hallenliste
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`upload-zone ${drag ? 'upload-zone--active' : ''} ${file ? 'upload-zone--has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
        />
        {file ? (
          <>
            <div style={{ fontSize: 36 }}>📄</div>
            <p style={{ fontWeight: 600, color: 'var(--lmo-pine)', marginTop: 8 }}>{file.name}</p>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
              {(file.size / 1024).toFixed(0)} KB · Klicken um andere Datei wählen
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40 }}>📂</div>
            <p style={{ fontWeight: 600, color: 'var(--lmo-pine)', marginTop: 10 }}>
              Hallenliste hierher ziehen
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              oder klicken zum Auswählen · Excel (.xlsx)
            </p>
          </>
        )}
      </div>

      <div className="form-section" style={{ marginTop: 16 }}>
        <div className="form-section__title">Zuordnung</div>
        <div className="form-grid-2">
          <div className="field">
            <label>Depot <span className="req">*</span></label>
            <select value={depot} onChange={e => setDepot(e.target.value)}>
              <option value="">– bitte wählen –</option>
              {DEPOTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Zustelldatum <span className="req">*</span></label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="form-actions">
        <button className="btn-secondary" onClick={() => { setFile(null); setError(''); }}>Zurücksetzen</button>
        <button className="btn-primary" onClick={upload} disabled={loading || !file}>
          {loading ? 'Wird importiert…' : '↑ Hallenliste importieren'}
        </button>
      </div>
    </>
  );
}

// ─── Dispoplan upload ─────────────────────────────────────────────────────────

function DispoplanUpload({ hallenlisten }: { hallenlisten: HlEntry[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const today   = new Date().toISOString().split('T')[0];

  const [file,    setFile]    = useState<File | null>(null);
  const [depot,   setDepot]   = useState('');
  const [datum,   setDatum]   = useState(today);
  const [drag,    setDrag]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ zugeordnet: number; uebersprungen: number } | null>(null);
  const [error,   setError]   = useState('');

  // Pre-fill depot/datum from the most recent hallenliste
  useEffect(() => {
    if (hallenlisten.length > 0 && !depot) {
      const hl = hallenlisten[0];
      setDepot(hl.depot);
      setDatum(hl.datum);
    }
  }, [hallenlisten]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function upload() {
    if (!file)  { setError('Bitte eine Datei auswählen.'); return; }
    if (!depot) { setError('Bitte ein Depot auswählen.'); return; }
    setError('');
    setLoading(true);

    const fd = new FormData();
    fd.append('file',  file);
    fd.append('depot', depot);
    fd.append('datum', datum);

    try {
      const res  = await fetch('/api/dispoplan', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler beim Upload');
      setResult({ zugeordnet: data.zugeordnet, uebersprungen: data.uebersprungen });
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="upload-success">
        <div className="upload-success__icon">✅</div>
        <h3>Dispoplan importiert</h3>
        <p>
          <strong>{result.zugeordnet} Touren</strong> mit Fahrerdaten verknüpft.
          {result.uebersprungen > 0 && (
            <span style={{ color: 'var(--muted)', marginLeft: 8 }}>
              ({result.uebersprungen} ohne passende Tour übersprungen)
            </span>
          )}
        </p>
        <div className="upload-success__actions">
          <button className="btn-secondary" onClick={() => { setResult(null); setFile(null); }}>
            Weiteren Dispoplan laden
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`upload-zone ${drag ? 'upload-zone--active' : ''} ${file ? 'upload-zone--has-file' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
        />
        {file ? (
          <>
            <div style={{ fontSize: 36 }}>📄</div>
            <p style={{ fontWeight: 600, color: 'var(--lmo-pine)', marginTop: 8 }}>{file.name}</p>
            <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
              {(file.size / 1024).toFixed(0)} KB · Klicken um andere Datei wählen
            </p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40 }}>📋</div>
            <p style={{ fontWeight: 600, color: 'var(--lmo-pine)', marginTop: 10 }}>
              Dispoplan hierher ziehen
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
              Reiter „Dispoplan" mit Fahrer- und Telefondaten
            </p>
          </>
        )}
      </div>

      <div className="form-section" style={{ marginTop: 16 }}>
        <div className="form-section__title">Passende Hallenliste</div>
        <div className="form-grid-2">
          <div className="field">
            <label>Depot <span className="req">*</span></label>
            <select value={depot} onChange={e => setDepot(e.target.value)}>
              <option value="">– bitte wählen –</option>
              {DEPOTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Zustelldatum <span className="req">*</span></label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
          </div>
        </div>
        {hallenlisten.length > 0 && (
          <div className="info-box" style={{ marginTop: 8 }}>
            Verfügbare Hallenlisten:{' '}
            {hallenlisten.slice(0, 3).map(h => (
              <button
                key={h.id}
                className="btn-secondary"
                style={{ fontSize: 11, padding: '2px 8px', marginLeft: 6 }}
                onClick={() => { setDepot(h.depot); setDatum(h.datum); }}
              >
                {h.datum} · {h.depot.split('–')[1]?.trim() ?? h.depot}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="form-actions">
        <button className="btn-secondary" onClick={() => { setFile(null); setError(''); }}>Zurücksetzen</button>
        <button className="btn-primary" onClick={upload} disabled={loading || !file}>
          {loading ? 'Wird importiert…' : '↑ Dispoplan importieren'}
        </button>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [activeTab,    setActiveTab]    = useState<'hallenliste' | 'dispoplan'>('hallenliste');
  const [hallenlisten, setHallenlisten] = useState<HlEntry[]>([]);

  async function loadHallenlisten() {
    const res  = await fetch('/api/hallenlisten');
    const data = await res.json() as HlEntry[];
    setHallenlisten(data);
  }

  useEffect(() => { loadHallenlisten(); }, []);

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <a href="/" className="back-link">← Zurück zur Übersicht</a>

      <div className="page-heading">
        <div>
          <h1>Listen importieren</h1>
          <p>Hallenliste und Dispoplan hochladen – täglich vom Disponenten</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="upload-tabs">
        <button
          className={`upload-tab ${activeTab === 'hallenliste' ? 'upload-tab--active' : ''}`}
          onClick={() => setActiveTab('hallenliste')}
        >
          📋 Hallenliste
        </button>
        <button
          className={`upload-tab ${activeTab === 'dispoplan' ? 'upload-tab--active' : ''}`}
          onClick={() => setActiveTab('dispoplan')}
        >
          👤 Dispoplan
        </button>
      </div>

      <div className="upload-card">
        {activeTab === 'hallenliste' ? (
          <>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              Touren und Stopps für den nächsten Zustelltag importieren. Das Callcenter sieht
              danach alle Stopps und muss nur noch den Status setzen.
            </p>
            <HallenlisteUpload onSuccess={loadHallenlisten} />
            <div className="info-box" style={{ marginTop: 20 }}>
              <strong>Was passiert beim Import?</strong>
              <ul>
                <li>Alle Touren und Stops werden automatisch eingelesen</li>
                <li>Kunde, Adresse, Tour-Nr. und Unternehmer werden vorausgefüllt</li>
                <li>Bei einem neuen Upload für denselben Tag wird die Liste ersetzt</li>
              </ul>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
              Fahrernamen und Telefonnummern aus dem Dispoplan hochladen. Die Daten werden
              automatisch den passenden Touren der Hallenliste zugeordnet.
            </p>
            <DispoplanUpload hallenlisten={hallenlisten} />
            <div className="info-box" style={{ marginTop: 20 }}>
              <strong>Voraussetzung:</strong>
              <ul>
                <li>Die passende Hallenliste muss bereits hochgeladen sein</li>
                <li>Depot und Datum müssen übereinstimmen</li>
                <li>Fahrer-Telefonnummern erscheinen direkt auf den Tour-Karten</li>
                <li>Wiederholtes Hochladen aktualisiert die Daten</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
