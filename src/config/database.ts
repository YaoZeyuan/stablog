import path from 'path'
class Database {
  static readonly version = '1.1.0'
  static readonly uri: string = path.resolve(__dirname, `../../mblog_v${Database.version}.sqlite`)
}
export default Database
