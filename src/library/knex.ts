import createKnex, { Knex as KnexType } from 'knex'
import Database from '~/src/config/database.js'

let activeClient: KnexType | undefined
let activeDatabaseUri = ''

function createClient(databaseUri: string): KnexType {
  return createKnex({
    client: 'better-sqlite3',
    connection: {
      filename: databaseUri,
    },
    useNullAsDefault: true,
    pool: {
      max: 1,
      min: 0,
      idleTimeoutMillis: 100,
      reapIntervalMillis: 150,
    },
    acquireConnectionTimeout: 60000,
  })
}

function getClient(): KnexType {
  if (activeClient === undefined || activeDatabaseUri !== Database.uri) {
    if (activeClient !== undefined) {
      void activeClient.destroy()
    }
    activeDatabaseUri = Database.uri
    activeClient = createClient(activeDatabaseUri)
  }
  return activeClient
}

const Knex = new Proxy({} as KnexType, {
  get(_target, property) {
    if (property === 'destroy') {
      return async () => {
        if (activeClient !== undefined) {
          await activeClient.destroy()
          activeClient = undefined
          activeDatabaseUri = ''
        }
      }
    }
    const client = getClient() as unknown as Record<PropertyKey, unknown>
    const value = client[property]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export default Knex
