import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { Capacitor } from '@capacitor/core'

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

let sqliteConnection: SQLiteConnection | null = null
let databaseConnection: SQLiteDBConnection | null = null

function getSQLiteConnection(): SQLiteConnection {
  if (!sqliteConnection) {
    sqliteConnection = new SQLiteConnection(CapacitorSQLite)
  }

  return sqliteConnection
}

async function ensureWebStoreReady(connection: SQLiteConnection): Promise<void> {
  if (Capacitor.getPlatform() !== 'web') {
    return
  }

  await customElements.whenDefined('jeep-sqlite')
  const jeepSqliteEl = document.querySelector('jeep-sqlite')

  if (!jeepSqliteEl) {
    throw new Error('jeep-sqlite element is missing. Web SQLite bridge is not ready.')
  }

  await connection.initWebStore()
}

export async function getDatabaseConnection(): Promise<SQLiteDBConnection> {
  if (databaseConnection) {
    return databaseConnection
  }

  const connection = getSQLiteConnection()
  await ensureWebStoreReady(connection)

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

  return databaseConnection
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!databaseConnection) {
    return
  }

  await databaseConnection.close()
  databaseConnection = null
}
