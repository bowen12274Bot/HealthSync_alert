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

/** 週期健康紀錄表，由 packer 模組每 10 分鐘聚合寫入一次，供同步使用 */
const CREATE_PERIODIC_HEALTH_RECORDS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS periodic_health_records (
    id TEXT PRIMARY KEY NOT NULL,
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    avg_hr INTEGER NOT NULL,
    min_hr INTEGER NOT NULL,
    max_hr INTEGER NOT NULL,
    avg_hrv INTEGER NOT NULL,
    avg_spo2 REAL NOT NULL,
    min_spo2 REAL NOT NULL,
    dominant_activity_level INTEGER NOT NULL,
    sample_count INTEGER NOT NULL,
    sync_status TEXT DEFAULT 'pending',
    raw_data_payload BLOB,
    created_at TEXT NOT NULL
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
  await databaseConnection.execute(CREATE_PERIODIC_HEALTH_RECORDS_TABLE_SQL)

  return databaseConnection
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!databaseConnection) {
    return
  }

  await databaseConnection.close()
  databaseConnection = null
}
