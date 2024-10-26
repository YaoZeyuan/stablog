import knex from 'knex'
import Database from '~/src/config/database'
/**  knex 方式 */

const Knex = knex({
  client: 'better-sqlite3',
  connection: {
    filename: Database.uri
  },
  useNullAsDefault: true,
  pool: {
    max: 1, // 不能开多线程去访问同一个sqllite实例, 否则会报SQLITE_BUSY错误
    min: 0,
    // 由于存在资源池, 导致句柄不被释放, 程序不能退出
    // 因此将最小句柄数设为0, 每100ms检查一次是否有超过120ms未被使用的资源
    // 以便句柄的及时回收
    // free resouces are destroyed after this many milliseconds
    idleTimeoutMillis: 100,
    // how often to check for idle resources to destroy
    reapIntervalMillis: 150
  },
  acquireConnectionTimeout: 60000
})

export default Knex
