export type ImageQuality = 'default' | 'none' | 'raw' | 'hd'
export type CacheReadMode = 'prefer-cache' | 'refresh'
export type TaskItemStatus = 'pending' | 'running' | 'succeeded' | 'failed'
export type TaskStatus = TaskItemStatus | 'partial_success'
export type TaskPhase = 'planning' | 'fetching' | 'generating' | 'done'

export type CustomerTaskRecord = {
  uid: string
  rawInputText: string
  comment: string
}

export type CustomerTaskConfig = {
  configList: CustomerTaskRecord[]
  imageQuilty: ImageQuality
  bookTitle: string
  comment: string
  postAtOrderBy: 'desc' | 'asc'
  fetchStartDate: string
  fetchEndDate: string
  requestIntervalSeconds: number
  cacheReadMode: CacheReadMode
  outputStartAtMs: number
  outputEndAtMs: number
  isSkipFetch: boolean
  isSkipGeneratePdf: boolean
  isRegenerateHtml2PdfImage: boolean
  isOnlyArticle: boolean
  isOnlyOriginal: boolean
  volumeSplitBy: 'single' | 'year' | 'month' | 'count'
  volumeSplitCount: number
}

export type TaskProgressCounts = {
  total: number
  pending: number
  running: number
  succeeded: number
  failed: number
  cacheHits: number
}

export type TaskCurrentNode = {
  uid: string
  screenName?: string
  year?: number
  month?: number
  segmentStartDate?: string
  segmentEndDate?: string
  page?: number
  pageCount?: number
}

export type TaskUserProgress = {
  uid: string
  screenName?: string
  status: TaskStatus
  counts: TaskProgressCounts
}

export type CustomerTaskBatch = {
  batchId: string
  status: TaskStatus
  resumable: boolean
  phase: TaskPhase
  createdAt: number
  startedAt?: number
  finishedAt?: number
  estimatedRemainingSeconds: number | null
  current?: TaskCurrentNode
  counts: TaskProgressCounts
  users: TaskUserProgress[]
}

export type CustomerTaskDashboard = {
  activeRun: null | {
    batchId: string
    runId: string
  }
  batch: CustomerTaskBatch | null
}

export type CustomerTaskFailure = {
  taskId: string
  taskType: 'year_probe' | 'month_probe' | 'segment_probe' | 'page' | 'long_text' | 'article'
  uid: string
  screenName?: string
  segmentStartDate?: string
  segmentEndDate?: string
  page?: number
  attempts: number
  errorCode?: string
  errorMessage?: string
  updatedAt?: number
}

export type TaskCommandAck = {
  outcome: 'started' | 'already_running'
  batchId: string
  runId: string
}

export type CustomerTaskFailureList = {
  items: CustomerTaskFailure[]
  total: number
}

export const DEFAULT_CUSTOMER_TASK_CONFIG: CustomerTaskConfig = {
  configList: [{ uid: '', rawInputText: '', comment: '' }],
  imageQuilty: 'default',
  bookTitle: '',
  comment: '',
  postAtOrderBy: 'asc',
  fetchStartDate: '2009-09-01',
  fetchEndDate: '',
  requestIntervalSeconds: 10,
  cacheReadMode: 'prefer-cache',
  outputStartAtMs: 0,
  outputEndAtMs: 0,
  isSkipFetch: false,
  isSkipGeneratePdf: false,
  isRegenerateHtml2PdfImage: false,
  isOnlyArticle: false,
  isOnlyOriginal: false,
  volumeSplitBy: 'single',
  volumeSplitCount: 10000,
}

export const IMAGE_QUALITY = {
  DEFAULT: 'default',
  NONE: 'none',
} as const

export const VOLUME_SPLIT_BY = {
  SINGLE: 'single',
  YEAR: 'year',
  MONTH: 'month',
  COUNT: 'count',
} as const
