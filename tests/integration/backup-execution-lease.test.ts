import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  BACKUP_EXECUTION_LEASE_NAME,
  BackupExecutionLeaseHandle,
  BackupExecutionLeaseRepository,
  resolveBackupExecutionLeaseDatabasePath,
} from '../../src/application/workflow/backup_execution_lease.js'
import {
  createFetchDatabaseClient,
  ensureFetchDatabaseSchema,
} from '../../src/application/fetch/fetch_database_schema.js'
import { ApplicationError } from '../../src/shared/error/application_error.js'
import { createTestSandbox, type TestSandbox } from '../helpers/sandbox.js'

describe('backup execution lease', () => {
  let sandbox: TestSandbox
  let databaseA: ReturnType<typeof createFetchDatabaseClient>
  let databaseB: ReturnType<typeof createFetchDatabaseClient>

  beforeEach(async () => {
    sandbox = createTestSandbox('backup-execution-lease')
    databaseA = createFetchDatabaseClient(sandbox.databasePath)
    databaseB = createFetchDatabaseClient(sandbox.databasePath)
    await ensureFetchDatabaseSchema(databaseA)
    await ensureFetchDatabaseSchema(databaseB)
  })

  afterEach(async () => {
    await databaseA.destroy()
    await databaseB.destroy()
    sandbox.cleanup()
  })

  it('atomically allows only one of two different runIds to acquire an empty lease', async () => {
    const repositoryA = new BackupExecutionLeaseRepository(databaseA, { now: () => 1_000 })
    const repositoryB = new BackupExecutionLeaseRepository(databaseB, { now: () => 1_000 })

    const outcomes = await Promise.allSettled([
      repositoryA.acquire({ runId: 'run-a', ownerKind: 'test-a' }),
      repositoryB.acquire({ runId: 'run-b', ownerKind: 'test-b' }),
    ])

    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1)
    const rejection = outcomes.find(({ status }) => status === 'rejected')
    expect(rejection).toMatchObject({
      status: 'rejected',
      reason: expect.objectContaining({
        name: 'ApplicationError',
        stage: 'workflow-lease',
        retryable: true,
      }),
    })
    expect(await databaseA('workflow_execution_lease').count<{ count: number }>({ count: '*' }).first())
      .toMatchObject({ count: 1 })
  })

  it('lets the same runId re-enter while preserving its original acquisition time', async () => {
    let nowA = 2_000
    let nowB = 2_100
    const repositoryA = new BackupExecutionLeaseRepository(databaseA, { now: () => nowA })
    const repositoryB = new BackupExecutionLeaseRepository(databaseB, { now: () => nowB })
    await repositoryA.acquire({ runId: 'run-shared', ownerKind: 'gui-manager' })

    const reentered = await repositoryB.acquire({ runId: 'run-shared', ownerKind: 'gui-workflow' })

    expect(reentered).toMatchObject({
      leaseName: BACKUP_EXECUTION_LEASE_NAME,
      runId: 'run-shared',
      ownerKind: 'gui-workflow',
      acquiredAt: 2_000,
      heartbeatAt: 2_100,
    })
    nowA = 2_200
    await repositoryA.heartbeat({ runId: 'run-shared' })
    expect((await repositoryB.get())?.heartbeatAt).toBe(2_200)
  })

  it('rejects a fresh foreign lease and atomically takes it over once heartbeat is stale', async () => {
    let contenderNow = 10_099
    const owner = new BackupExecutionLeaseRepository(databaseA, {
      now: () => 10_000,
      staleAfterMs: 100,
    })
    const contender = new BackupExecutionLeaseRepository(databaseB, {
      now: () => contenderNow,
      staleAfterMs: 100,
    })
    await owner.acquire({ runId: 'run-old', ownerKind: 'cli-workflow', ownerPid: 0 })

    await expect(contender.acquire({ runId: 'run-new', ownerKind: 'gui-manager' }))
      .rejects.toBeInstanceOf(ApplicationError)

    contenderNow = 10_100
    const takenOver = await contender.acquire({ runId: 'run-new', ownerKind: 'gui-manager' })
    expect(takenOver).toMatchObject({
      runId: 'run-new',
      acquiredAt: 10_100,
      heartbeatAt: 10_100,
    })
    await expect(owner.heartbeat({ runId: 'run-old' })).rejects.toMatchObject({
      message: '备份流程执行租约已丢失',
    })
    expect(await owner.release({ runId: 'run-old' })).toBe(false)
    expect(await contender.release({ runId: 'run-new' })).toBe(true)
  })

  it('immediately takes over a fresh lease whose owner PID is dead', async () => {
    const owner = new BackupExecutionLeaseRepository(databaseA, { now: () => 20_000 })
    const contender = new BackupExecutionLeaseRepository(databaseB, {
      now: () => 20_001,
      isProcessAlive: (pid) => pid !== 999_999,
    })
    await owner.acquire({
      runId: 'run-crashed',
      ownerKind: 'cli-workflow',
      ownerPid: 999_999,
    })

    const acquired = await contender.acquire({
      runId: 'run-restarted',
      ownerKind: 'startup-recovery',
    })

    expect(acquired).toMatchObject({
      runId: 'run-restarted',
      ownerKind: 'startup-recovery',
      acquiredAt: 20_001,
    })
  })

  it('keeps coordination durable while the business database is deleted by rebase', async () => {
    const rebaseDatabasePath = path.join(path.dirname(sandbox.databasePath), 'rebase.sqlite')
    fs.writeFileSync(rebaseDatabasePath, 'replaceable business database')
    const owner = await BackupExecutionLeaseHandle.acquire(
      rebaseDatabasePath,
      'run-rebase-owner',
      { ownerKind: 'cli-workflow' },
    )
    try {
      expect(resolveBackupExecutionLeaseDatabasePath(rebaseDatabasePath))
        .not.toBe(rebaseDatabasePath)
      fs.rmSync(rebaseDatabasePath)
      expect(fs.existsSync(rebaseDatabasePath)).toBe(false)
      expect(fs.existsSync(resolveBackupExecutionLeaseDatabasePath(rebaseDatabasePath))).toBe(true)

      await expect(BackupExecutionLeaseHandle.acquire(
        rebaseDatabasePath,
        'run-contender',
        { ownerKind: 'gui-manager' },
      )).rejects.toMatchObject({ stage: 'workflow-lease' })
    } finally {
      await owner.release()
    }
  })
})
