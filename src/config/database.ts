import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))

class Database {
  static readonly version = '1.1.0'
  static uri: string = path.resolve(moduleDirectory, `../../mblog_v${Database.version}.sqlite`)

  static setUri(databaseUri: string) {
    Database.uri = path.resolve(databaseUri)
  }
}
export default Database
