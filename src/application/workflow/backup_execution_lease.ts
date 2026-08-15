import fs from 'node:fs/promises'
import path from 'node:path'
import type { Knex } from 'knex'
import {
  createFetchDatabaseClient,
} from '~/src/application/fetch/fetch_database_schema.js'
import {
  AppErrorCode,
  ApplicationError,
  ServiceLevel,
} from '~/src/shared/error/application_error.js'

export const BACKUP_EXECUTION_LEASE_NAME = 'backup-workflow'
export const DEFAULT_EXECUTION_LEASE_STALE_AFTER_MS = 5 * 60_000
export const DEFAULT_EXECUTION_LEASE_HEARTBEAT_INTERVAL_MS = 5_000

const EXECUTION_LEASE_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS workflow_execution_lease (
  lease_name varchar(80) NOT NULL PRIMARY KEY,
  run_id varchar(120) NOT NULL,
  owner_kind varchar(40) NOT NULL,
  owner_pid INTEGER NOT NULL,
  acquired_at INTEGER NOT NULL CHECK (acquired_at >= 0),
  heartbeat_at INTEGER NOT NULL CHECK (heartbeat_at >= acquired_at)
)`

/** Coordination must survive and remain open while init --rebase replaces the business DB. */
export function resolveBackupExecutionLeaseDatabasePath(databasePath: string): string {
  return path.join(path.dirname(path.resolve(databasePath)), '.stablog-execution-lock.sqlite')
}

export async function ensureBackupExecutionLeaseSchema(database: Knex): Promise<void> {
  await database.raw('PRAGMA busy_timeout = 60000')
  await database.raw(EXECUTION_LEASE_SCHEMA_SQL)
  if (await database.schema.hasColumn('workflow_execution_lease', 'owner_pid') === false) {
    await database.schema.alterTable('workflow_execution_lease', (table) => {
      table.integer('owner_pid').notNullable().defaultTo(0)
    })
  }
}

export type BackupExecutionLeaseRow = {
  leaseName: string
  runId: string
  ownerKind: string
  ownerPid: number
  acquiredAt: number
  heartbeatAt: number
}

type LeaseDatabaseRow = {
  lease_name: string
  run_id: string
  owner_kind: string
  owner_pid: number
  acquired_at: number
  heartbeat_at: number
}

export type BackupExecutionLeaseRepositoryOptions = {
  now?: () => number
  staleAfterMs?: number
  isProcessAlive?: (pid: number) => boolean
}

/**
 * SQLite-backed, process-independent execution lease.
 *
 * Acquisition is one INSERT ... ON CONFLICT DO UPDATE statement. The WHERE
 * clause on the conflicting row is the lock predicate, so two processes can
 * never both win through a SELECT/INSERT race.
 */
export class BackupExecutionLeaseRepository {
  private readonly now: () => number
  private readonly staleAfterMs: number
  private readonly isProcessAlive: (pid: number) => boolean

  constructor(
    private readonly database: Knex,
    options: BackupExecutionLeaseRepositoryOptions = {},
  ) {
    this.now = options.now ?? Date.now
    this.staleAfterMs = options.staleAfterMs ?? DEFAULT_EXECUTION_LEASE_STALE_AFTER_MS
    this.isProcessAlive = options.isProcessAlive ?? isLocalProcessAlive
    if (!Number.isSafeInteger(this.staleAfterMs) || this.staleAfterMs <= 0) {
      throw new TypeError('staleAfterMs must be a positive safe integer')
    }
  }

  async acquire(input: {
    runId: string
    ownerKind: string
    ownerPid?: number
    leaseName?: string
  }): Promise<BackupExecutionLeaseRow> {
    const leaseName = requireText(input.leaseName ?? BACKUP_EXECUTION_LEASE_NAME, 'leaseName')
    const runId = requireText(input.runId, 'runId')
    const ownerKind = requireText(input.ownerKind, 'ownerKind')
    const ownerPid = input.ownerPid ?? process.pid
    if (!Number.isSafeInteger(ownerPid) || ownerPid < 0) {
      throw new TypeError('ownerPid must be a non-negative safe integer')
    }
    const now = this.now()
    requireTimestamp(now)
    const staleBefore = now - this.staleAfterMs

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await this.database.raw(
        `INSERT INTO workflow_execution_lease
          (lease_name, run_id, owner_kind, owner_pid, acquired_at, heartbeat_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(lease_name) DO UPDATE SET
           owner_kind = excluded.owner_kind,
           owner_pid = excluded.owner_pid,
           heartbeat_at = excluded.heartbeat_at
         WHERE workflow_execution_lease.run_id = excluded.run_id`,
        [leaseName, runId, ownerKind, ownerPid, now, now],
      ) as { changes?: number }

      if (result.changes === 1) return this.requireOwnedLease(leaseName, runId)

      const holder = await this.get(leaseName)
      if (holder === null) continue
      const deadOwner = holder.ownerPid > 0 && this.isProcessAlive(holder.ownerPid) === false
      const unknownOwnerIsStale = holder.ownerPid === 0 && holder.heartbeatAt <= staleBefore
      if (deadOwner || unknownOwnerIsStale) {
        const replaced = await this.database<LeaseDatabaseRow>('workflow_execution_lease')
          .where({
            lease_name: leaseName,
            run_id: holder.runId,
            owner_pid: holder.ownerPid,
            heartbeat_at: holder.heartbeatAt,
          })
          .update({
            run_id: runId,
            owner_kind: ownerKind,
            owner_pid: ownerPid,
            acquired_at: now,
            heartbeat_at: now,
          })
        if (replaced === 1) return this.requireOwnedLease(leaseName, runId)
        continue
      }
      throw leaseConflict(leaseName, holder)
    }
    throw leaseConflict(leaseName, await this.get(leaseName))
  }

  private async requireOwnedLease(leaseName: string, runId: string): Promise<BackupExecutionLeaseRow> {
    const acquired = await this.get(leaseName)
    if (acquired === null || acquired.runId !== runId) {
      throw new ApplicationError({
        code: AppErrorCode.DATABASE_FAILED,
        message: '备份流程执行租约写入后无法确认',
        serviceLevel: ServiceLevel.S0,
        stage: 'workflow-lease',
        retryable: true,
      })
    }
    return acquired
  }

  async heartbeat(input: { runId: string; leaseName?: string }): Promise<void> {
    const leaseName = requireText(input.leaseName ?? BACKUP_EXECUTION_LEASE_NAME, 'leaseName')
    const runId = requireText(input.runId, 'runId')
    const now = this.now()
    requireTimestamp(now)
    const updated = await this.database<LeaseDatabaseRow>('workflow_execution_lease')
      .where({ lease_name: leaseName, run_id: runId })
      .update({ heartbeat_at: now })
    if (updated !== 1) {
      throw new ApplicationError({
        code: AppErrorCode.WORKFLOW_FAILED,
        message: '备份流程执行租约已丢失',
        serviceLevel: ServiceLevel.S1,
        stage: 'workflow-lease',
        retryable: true,
        details: { leaseName, runId },
      })
    }
  }

  async release(input: { runId: string; leaseName?: string }): Promise<boolean> {
    const leaseName = requireText(input.leaseName ?? BACKUP_EXECUTION_LEASE_NAME, 'leaseName')
    const runId = requireText(input.runId, 'runId')
    const deleted = await this.database<LeaseDatabaseRow>('workflow_execution_lease')
      .where({ lease_name: leaseName, run_id: runId })
      .delete()
    return deleted === 1
  }

  async get(leaseName = BACKUP_EXECUTION_LEASE_NAME): Promise<BackupExecutionLeaseRow | null> {
    const row = await this.database<LeaseDatabaseRow>('workflow_execution_lease')
      .where({ lease_name: requireText(leaseName, 'leaseName') })
      .first()
    return row === undefined ? null : mapRow(row)
  }
}

export type BackupExecutionLeaseHandleOptions = BackupExecutionLeaseRepositoryOptions & {
  ownerKind: string
  heartbeatIntervalMs?: number
}

/** Owns the SQLite connection and heartbeat timer for one acquired lease. */
export class BackupExecutionLeaseHandle {
  private timer: ReturnType<typeof setInterval> | undefined
  private heartbeatInFlight: Promise<void> | undefined
  private heartbeatError: unknown
  private released = false

  private constructor(
    private readonly database: Knex,
    private readonly repository: BackupExecutionLeaseRepository,
    readonly runId: string,
    private readonly heartbeatIntervalMs: number,
  ) {}

  static async acquire(
    databasePath: string,
    runId: string,
    options: BackupExecutionLeaseHandleOptions,
  ): Promise<BackupExecutionLeaseHandle> {
    const heartbeatIntervalMs = options.heartbeatIntervalMs
      ?? DEFAULT_EXECUTION_LEASE_HEARTBEAT_INTERVAL_MS
    if (!Number.isSafeInteger(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
      throw new TypeError('heartbeatIntervalMs must be a positive safe integer')
    }
    const leaseDatabasePath = resolveBackupExecutionLeaseDatabasePath(databasePath)
    await fs.mkdir(path.dirname(leaseDatabasePath), { recursive: true })
    const database = createFetchDatabaseClient(leaseDatabasePath)
    try {
      await ensureBackupExecutionLeaseSchema(database)
      const repository = new BackupExecutionLeaseRepository(database, options)
      await repository.acquire({ runId, ownerKind: options.ownerKind })
      const handle = new BackupExecutionLeaseHandle(
        database,
        repository,
        runId,
        heartbeatIntervalMs,
      )
      handle.startHeartbeat()
      return handle
    } catch (error) {
      await database.destroy()
      throw error
    }
  }

  assertHealthy(): void {
    if (this.heartbeatError !== undefined) throw this.heartbeatError
  }

  async release(): Promise<void> {
    if (this.released) return
    this.released = true
    if (this.timer !== undefined) clearInterval(this.timer)
    try {
      await this.heartbeatInFlight
      await this.repository.release({ runId: this.runId })
    } finally {
      await this.database.destroy()
    }
  }

  private startHeartbeat(): void {
    this.timer = setInterval(() => {
      if (this.heartbeatInFlight !== undefined || this.released) return
      const heartbeat = this.repository.heartbeat({ runId: this.runId })
      this.heartbeatInFlight = heartbeat
      void heartbeat
        .catch((error: unknown) => {
          this.heartbeatError = error
        })
        .finally(() => {
          if (this.heartbeatInFlight === heartbeat) this.heartbeatInFlight = undefined
        })
    }, this.heartbeatIntervalMs)
    this.timer.unref?.()
  }
}

function mapRow(row: LeaseDatabaseRow): BackupExecutionLeaseRow {
  return {
    leaseName: row.lease_name,
    runId: row.run_id,
    ownerKind: row.owner_kind,
    ownerPid: row.owner_pid,
    acquiredAt: row.acquired_at,
    heartbeatAt: row.heartbeat_at,
  }
}

function leaseConflict(
  leaseName: string,
  holder: BackupExecutionLeaseRow | null,
): ApplicationError {
  return new ApplicationError({
    code: AppErrorCode.WORKFLOW_FAILED,
    message: '已有另一个备份流程正在运行，请稍后重试',
    serviceLevel: ServiceLevel.S1,
    stage: 'workflow-lease',
    retryable: true,
    details: holder === null
      ? { leaseName }
      : {
          leaseName,
          holderRunId: holder.runId,
          holderOwnerKind: holder.ownerKind,
          holderOwnerPid: holder.ownerPid,
          heartbeatAt: holder.heartbeatAt,
        },
  })
}

function isLocalProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function requireText(value: string, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} must be a non-empty string`)
  }
  return value
}

function requireTimestamp(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('lease timestamp must be a non-negative safe integer')
  }
}
