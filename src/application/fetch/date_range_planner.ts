import dayjs, { Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export const WEIBO_TIME_ZONE = 'Asia/Shanghai'
export const EARLIEST_WEIBO_DATE = '2009-09-01'
export const SEARCH_PROFILE_PAGE_SIZE = 50

export type DateRangeKind = 'year' | 'month' | 'segment'

export type ClosedDateRange = {
  kind: DateRangeKind
  key: string
  startAt: number
  endAt: number
  startDate: string
  endDate: string
}

export type PlannedMonth = ClosedDateRange & {
  kind: 'month'
  segments: ClosedDateRange[]
}

export type PlannedYear = ClosedDateRange & {
  kind: 'year'
  months: PlannedMonth[]
}

function parseDate(value: string, label: string): Dayjs {
  const parsed = dayjs.tz(value, 'YYYY-MM-DD', WEIBO_TIME_ZONE)
  if (parsed.isValid() === false || parsed.format('YYYY-MM-DD') !== value) {
    throw new TypeError(`${label}必须是有效的 YYYY-MM-DD 北京日期`)
  }
  return parsed
}

function parseParentRange(
  range: Pick<ClosedDateRange, 'startDate' | 'endDate'>,
): [Dayjs, Dayjs] {
  const start = parseDate(range.startDate, 'range.startDate')
  const end = parseDate(range.endDate, 'range.endDate')
  if (end.isBefore(start, 'day')) {
    throw new RangeError('range.endDate 不得早于 range.startDate')
  }
  return [start, end]
}

function rangeFromDays(kind: DateRangeKind, key: string, start: Dayjs, end: Dayjs): ClosedDateRange {
  return {
    kind,
    key,
    startAt: start.startOf('day').unix(),
    endAt: end.endOf('day').unix(),
    startDate: start.format('YYYY-MM-DD'),
    endDate: end.format('YYYY-MM-DD'),
  }
}

function intersectRange(
  kind: DateRangeKind,
  key: string,
  candidateStart: Dayjs,
  candidateEnd: Dayjs,
  parentStart: Dayjs,
  parentEnd: Dayjs,
): ClosedDateRange | undefined {
  const start = candidateStart.isAfter(parentStart) ? candidateStart : parentStart
  const end = candidateEnd.isBefore(parentEnd) ? candidateEnd : parentEnd
  return end.isBefore(start) ? undefined : rangeFromDays(kind, key, start, end)
}

export function createFetchDateRange(options: {
  startDate?: string
  endDate?: string
  startedAtMs?: number
} = {}): ClosedDateRange {
  const startedAtMs = options.startedAtMs ?? Date.now()
  if (Number.isFinite(startedAtMs) === false) {
    throw new TypeError('startedAtMs 必须是有限数值')
  }
  const startedDay = dayjs(startedAtMs).tz(WEIBO_TIME_ZONE)
  const start = parseDate(options.startDate ?? EARLIEST_WEIBO_DATE, 'startDate')
  const end = parseDate(options.endDate ?? startedDay.format('YYYY-MM-DD'), 'endDate')
  const earliest = parseDate(EARLIEST_WEIBO_DATE, '最早抓取日期')
  if (start.isBefore(earliest, 'day')) {
    throw new RangeError(`startDate 不得早于 ${EARLIEST_WEIBO_DATE}`)
  }
  if (end.isAfter(startedDay, 'day')) {
    throw new RangeError('endDate 不得晚于任务启动日')
  }
  if (end.isBefore(start, 'day')) {
    throw new RangeError('endDate 不得早于 startDate')
  }
  return rangeFromDays('year', `${start.format('YYYY-MM-DD')}~${end.format('YYYY-MM-DD')}`, start, end)
}

export function planYearRanges(range: Pick<ClosedDateRange, 'startDate' | 'endDate'>): ClosedDateRange[] {
  const [parentStart, parentEnd] = parseParentRange(range)
  const result: ClosedDateRange[] = []
  for (let year = parentStart.year(); year <= parentEnd.year(); year += 1) {
    const yearStart = dayjs.tz(`${year}-01-01`, 'YYYY-MM-DD', WEIBO_TIME_ZONE)
    const yearRange = intersectRange(
      'year',
      `${year}`,
      yearStart,
      yearStart.endOf('year'),
      parentStart,
      parentEnd,
    )
    if (yearRange !== undefined) result.push(yearRange)
  }
  return result
}

export function planMonthRanges(range: Pick<ClosedDateRange, 'startDate' | 'endDate'>): PlannedMonth[] {
  const [parentStart, parentEnd] = parseParentRange(range)
  const result: PlannedMonth[] = []
  let monthStart = parentStart.startOf('month')
  const finalMonth = parentEnd.startOf('month')
  while (monthStart.isAfter(finalMonth, 'month') === false) {
    const key = monthStart.format('YYYY-MM')
    const monthRange = intersectRange(
      'month',
      key,
      monthStart,
      monthStart.endOf('month'),
      parentStart,
      parentEnd,
    )
    if (monthRange !== undefined) {
      result.push({
        ...monthRange,
        kind: 'month',
        segments: planSegmentRanges(monthRange),
      })
    }
    monthStart = monthStart.add(1, 'month').startOf('month')
  }
  return result
}

export function planSegmentRanges(range: Pick<ClosedDateRange, 'startDate' | 'endDate'>): ClosedDateRange[] {
  const [parentStart, parentEnd] = parseParentRange(range)
  if (parentStart.format('YYYY-MM') !== parentEnd.format('YYYY-MM')) {
    throw new RangeError('日期段规划的父范围不得跨月')
  }
  const monthStart = parentStart.startOf('month')
  const daysInMonth = monthStart.daysInMonth()
  const boundaries: Array<[number, number]> = [
    [1, 7],
    [8, 14],
    [15, 21],
    [22, 28],
    [29, daysInMonth],
  ]
  const result: ClosedDateRange[] = []
  for (const [startDay, rawEndDay] of boundaries) {
    if (startDay > daysInMonth) continue
    const endDay = Math.min(rawEndDay, daysInMonth)
    const candidateStart = monthStart.date(startDay)
    const candidateEnd = monthStart.date(endDay)
    const segment = intersectRange(
      'segment',
      `${candidateStart.format('YYYY-MM-DD')}~${candidateEnd.format('YYYY-MM-DD')}`,
      candidateStart,
      candidateEnd,
      parentStart,
      parentEnd,
    )
    if (segment !== undefined) result.push(segment)
  }
  return result
}

export function planDateHierarchy(range: Pick<ClosedDateRange, 'startDate' | 'endDate'>): PlannedYear[] {
  return planYearRanges(range).map((yearRange) => ({
    ...yearRange,
    kind: 'year',
    months: planMonthRanges(yearRange),
  }))
}

export function getPageCount(total: number, pageSize = SEARCH_PROFILE_PAGE_SIZE): number {
  if (Number.isSafeInteger(total) === false || total < 0) {
    throw new RangeError('total 必须是非负安全整数')
  }
  if (Number.isSafeInteger(pageSize) === false || pageSize <= 0) {
    throw new RangeError('pageSize 必须是正安全整数')
  }
  return Math.ceil(total / pageSize)
}

export function planPageNumbers(total: number, pageSize = SEARCH_PROFILE_PAGE_SIZE): number[] {
  return Array.from({ length: getPageCount(total, pageSize) }, (_, index) => index + 1)
}
