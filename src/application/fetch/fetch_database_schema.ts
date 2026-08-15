import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import createKnex, { type Knex } from 'knex'

const defaultSchemaPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../command/init.sql',
)

/**
 * Ensure the additive fetch-task schema exists before a GUI command creates a
 * batch. The normal application bootstrap runs the same SQL, but the explicit
 * boundary also keeps CLI and injected integration runs self-contained.
 */
export async function ensureFetchDatabaseSchema(
  database: Knex,
  schemaPath = defaultSchemaPath,
): Promise<void> {
  await database.raw('PRAGMA busy_timeout = 60000')
  await database.raw('PRAGMA foreign_keys = ON')
  const sqlContent = await fs.readFile(schemaPath, 'utf8')
  for (const statement of sqlContent.split(';')) {
    const normalized = statement.trim()
    if (normalized !== '') {
      await database.raw(normalized)
    }
  }
}

export { defaultSchemaPath as FETCH_DATABASE_SCHEMA_PATH }

/** Create an explicitly-scoped client for dashboard/manager work outside legacy globals. */
export function createFetchDatabaseClient(databasePath: string): Knex {
  return createKnex({
    client: 'better-sqlite3',
    connection: { filename: path.resolve(databasePath) },
    useNullAsDefault: true,
    pool: {
      min: 0,
      max: 1,
    },
    acquireConnectionTimeout: 60_000,
  })
}
