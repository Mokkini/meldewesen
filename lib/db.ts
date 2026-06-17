import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'meldewesen.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meldungen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datum TEXT NOT NULL,
      depot TEXT NOT NULL,
      tour TEXT,
      fahrer TEXT,
      unternehmer TEXT,
      typ TEXT NOT NULL DEFAULT 'zusteller',
      sendungsnummer TEXT,
      grund TEXT,
      grund_freitext TEXT,
      erneute_zustellung TEXT,
      meldung_abrechnung TEXT DEFAULT 'nein',
      tour_abgemeldet TEXT DEFAULT 'ja',
      kunde TEXT,
      adresse TEXT,
      zustell_status TEXT,
      erstellt_am TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      erstellt_von TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_datum   ON meldungen(datum);
    CREATE INDEX IF NOT EXISTS idx_depot   ON meldungen(depot);
    CREATE INDEX IF NOT EXISTS idx_status  ON meldungen(zustell_status);

    -- Imported Hallenlisten (one row per uploaded file)
    CREATE TABLE IF NOT EXISTS hallenlisten (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      depot       TEXT    NOT NULL,
      datum       TEXT    NOT NULL,
      dateiname   TEXT,
      fahrzeuge   INTEGER,
      stops_total INTEGER,
      erstellt_am TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_hl_datum ON hallenlisten(datum);

    -- Individual stops from a Hallenliste
    CREATE TABLE IF NOT EXISTS stops (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      hallenliste_id   INTEGER NOT NULL REFERENCES hallenlisten(id) ON DELETE CASCADE,
      fahrzeug         TEXT    NOT NULL,
      tour             TEXT    NOT NULL,
      unternehmer      TEXT    NOT NULL,
      reihenfolge      INTEGER,
      zeit             TEXT,
      art              TEXT    NOT NULL,
      kdnr             TEXT,
      kunde            TEXT,
      strasse          TEXT,
      plz              TEXT,
      ort              TEXT,
      sendungen        INTEGER,
      -- Status: 'offen' | 'ok' | 'problem'
      status           TEXT    NOT NULL DEFAULT 'offen',
      -- Filled when status = 'problem'
      fahrer           TEXT,
      grund            TEXT,
      grund_freitext   TEXT,
      erneute_zustellung TEXT  DEFAULT 'nein',
      meldung_abrechnung TEXT  DEFAULT 'nein',
      bearbeitet_am    TEXT,
      erstellt_am      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_stops_hl     ON stops(hallenliste_id);
    CREATE INDEX IF NOT EXISTS idx_stops_status ON stops(status);
    CREATE INDEX IF NOT EXISTS idx_stops_tour   ON stops(tour);

    -- Driver / subcontractor assignments per tour (from Dispoplan upload)
    CREATE TABLE IF NOT EXISTS fahrerzuordnungen (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      hallenliste_id  INTEGER NOT NULL REFERENCES hallenlisten(id) ON DELETE CASCADE,
      tour            TEXT    NOT NULL,
      dispoplan_tour  INTEGER NOT NULL,
      fhz_art         TEXT,
      tu              TEXT,
      fahrer_name     TEXT,
      fahrer_tel      TEXT,
      kennzeichen     TEXT,
      tu_name         TEXT,
      tu_tel          TEXT,
      soll_ankunft    TEXT,
      bemerkungen     TEXT,
      ist_ausfall     INTEGER DEFAULT 0,
      erstellt_am     TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_fz_hl_tour ON fahrerzuordnungen(hallenliste_id, tour);
  `);
}

export type Meldung = {
  id: number; datum: string; depot: string; tour: string | null;
  fahrer: string | null; unternehmer: string | null; typ: string;
  sendungsnummer: string | null; grund: string | null; grund_freitext: string | null;
  erneute_zustellung: string | null; meldung_abrechnung: string | null;
  tour_abgemeldet: string | null; kunde: string | null; adresse: string | null;
  zustell_status: string | null; erstellt_am: string; erstellt_von: string | null;
};

export type Hallenliste = {
  id: number; depot: string; datum: string; dateiname: string | null;
  fahrzeuge: number | null; stops_total: number | null; erstellt_am: string;
};

export type Stop = {
  id: number; hallenliste_id: number; fahrzeug: string;
  tour: string; unternehmer: string; reihenfolge: number | null;
  zeit: string | null; art: string; kdnr: string | null;
  kunde: string | null; strasse: string | null; plz: string | null;
  ort: string | null; sendungen: number | null;
  status: 'offen' | 'ok' | 'problem';
  fahrer: string | null; grund: string | null; grund_freitext: string | null;
  erneute_zustellung: string | null; meldung_abrechnung: string | null;
  bearbeitet_am: string | null; erstellt_am: string;
  // From fahrerzuordnungen JOIN (may be null if no Dispoplan uploaded)
  fahrer_name: string | null; fahrer_tel: string | null;
  tu_name: string | null;     tu_tel: string | null;
  kennzeichen: string | null;
};
