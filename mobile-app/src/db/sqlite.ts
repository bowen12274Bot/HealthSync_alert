import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

const DATABASE_NAME = 'healthsync_local.db'
const DATABASE_VERSION = 1
const DATABASE_READ_ONLY = false

const CREATE_LOCAL_RECORDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS local_records (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`

/** 即時健康資料表，由 data-collector 模組每 5 秒寫入一筆 */
const CREATE_REALTIME_HEALTH_RECORDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS realtime_health_records (
    id          TEXT    PRIMARY KEY NOT NULL,
    heart_rate  INTEGER NOT NULL,
    hrv         INTEGER NOT NULL,
    sp_o2       REAL    NOT NULL,
    activity_level INTEGER NOT NULL,
    recorded_at TEXT    NOT NULL
  );
`

/** 即時預警主表，由 alert-engine 在預警建立時寫入 */
const CREATE_REALTIME_ALERTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS realtime_alert (
    alert_id              TEXT PRIMARY KEY NOT NULL,
    alert_type            TEXT NOT NULL,
    initial_risk_score    INTEGER NOT NULL,
    trigger_reason        TEXT NOT NULL,
    detection_start_time  TEXT NOT NULL,
    detection_end_time    TEXT,
    first_occurred_at     TEXT NOT NULL,
    sync_status           TEXT NOT NULL
  );
`

/** 預警狀態歷史表，由 alert-engine 在狀態變化時追加寫入 */
const CREATE_ALERT_STATUS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS alert_status (
    status_id            TEXT PRIMARY KEY NOT NULL,
    alert_id             TEXT NOT NULL,
    status               TEXT NOT NULL,
    risk_score           INTEGER NOT NULL,
    status_time          TEXT NOT NULL,
    status_description   TEXT NOT NULL,
    FOREIGN KEY (alert_id) REFERENCES realtime_alert(alert_id)
  );
`

let sqliteConnection: SQLiteConnection | null = null
let databaseConnection: SQLiteDBConnection | null = null

function getSQLiteConnection(): SQLiteConnection {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  }

  return sqliteConnection
}

export async function getDatabaseConnection(): Promise<SQLiteDBConnection> {
  if (databaseConnection) {
    return databaseConnection
  }

  const connection = getSQLiteConnection()

  const consistency = await connection.checkConnectionsConsistency()
  const isConnectionAvailable = (await connection.isConnection(DATABASE_NAME, DATABASE_READ_ONLY)).result

  if (consistency.result && isConnectionAvailable) {
    databaseConnection = await connection.retrieveConnection(DATABASE_NAME, DATABASE_READ_ONLY)
  } else {
    databaseConnection = await connection.createConnection(
      DATABASE_NAME,
      DATABASE_READ_ONLY,
      'no-encryption',
      DATABASE_VERSION,
      false,
    )
  }

  await databaseConnection.open()
  await databaseConnection.execute(CREATE_LOCAL_RECORDS_TABLE_SQL)
  await databaseConnection.execute(CREATE_REALTIME_HEALTH_RECORDS_TABLE_SQL)
  await databaseConnection.execute(CREATE_REALTIME_ALERTS_TABLE_SQL)
  await databaseConnection.execute(CREATE_ALERT_STATUS_TABLE_SQL)

  return databaseConnection
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!databaseConnection) {
    return
  }

  await databaseConnection.close()
  databaseConnection = null
}
