import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invokeDesktop } from '@/library/desktop'
import type { CustomerTaskDashboard } from './task_type'

const EMPTY_DASHBOARD: CustomerTaskDashboard = {
  activeRun: null,
  batch: null,
}

export type TaskDashboardController = {
  dashboard: CustomerTaskDashboard
  isActive: boolean
  isLoading: boolean
  error: string
  selectedBatchId?: string
  refresh: () => Promise<void>
  selectBatch: (batchId?: string) => void
}

export function useTaskDashboard(): TaskDashboardController {
  const [dashboard, setDashboard] = useState<CustomerTaskDashboard>(EMPTY_DASHBOARD)
  const [selectedBatchId, setSelectedBatchId] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const isMountedRef = useRef(true)
  const isPollingRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadDashboard = useCallback(async () => {
    if (isPollingRef.current) {
      return
    }
    isPollingRef.current = true
    try {
      const nextDashboard = await invokeDesktop<CustomerTaskDashboard>(
        'get-customer-task-dashboard',
        selectedBatchId === undefined ? {} : { batchId: selectedBatchId },
      )
      if (isMountedRef.current) {
        setDashboard(nextDashboard)
        setError('')
      }
    } catch (pollError) {
      if (isMountedRef.current) {
        setError(pollError instanceof Error ? pollError.message : String(pollError))
      }
    } finally {
      isPollingRef.current = false
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [selectedBatchId])

  const isActive = dashboard.activeRun !== null || dashboard.batch?.status === 'running'

  useEffect(() => {
    void loadDashboard()
    const interval = window.setInterval(() => {
      void loadDashboard()
    }, isActive ? 1000 : 5000)
    return () => window.clearInterval(interval)
  }, [isActive, loadDashboard])

  return useMemo(() => ({
    dashboard,
    isActive,
    isLoading,
    error,
    selectedBatchId,
    refresh: loadDashboard,
    selectBatch: setSelectedBatchId,
  }), [dashboard, error, isActive, isLoading, loadDashboard, selectedBatchId])
}
