import { describe, expect, it } from 'vitest'
import {
  createFetchDateRange,
  getPageCount,
  planDateHierarchy,
  planMonthRanges,
  planPageNumbers,
  planSegmentRanges,
  planYearRanges,
} from '../../src/application/fetch/date_range_planner.js'

describe('北京时间日期任务规划', () => {
  const startedAtMs = Date.parse('2026-08-15T11:00:00+08:00')

  it('使用北京时间闭区间生成精确秒值', () => {
    const range = createFetchDateRange({
      startDate: '2017-01-01',
      endDate: '2017-02-01',
      startedAtMs,
    })

    expect(range.startAt).toBe(Date.parse('2017-01-01T00:00:00+08:00') / 1000)
    expect(range.endAt).toBe(Date.parse('2017-02-01T23:59:59+08:00') / 1000)
  })

  it('按年、月和固定日期段裁剪自定义范围', () => {
    const range = createFetchDateRange({
      startDate: '2019-12-30',
      endDate: '2020-03-02',
      startedAtMs,
    })
    expect(planYearRanges(range).map(({ startDate, endDate }) => [startDate, endDate]))
      .toEqual([
        ['2019-12-30', '2019-12-31'],
        ['2020-01-01', '2020-03-02'],
      ])

    const months = planMonthRanges(range)
    expect(months.map(({ startDate, endDate }) => [startDate, endDate])).toEqual([
      ['2019-12-30', '2019-12-31'],
      ['2020-01-01', '2020-01-31'],
      ['2020-02-01', '2020-02-29'],
      ['2020-03-01', '2020-03-02'],
    ])
    expect(months[2].segments.map(({ startDate, endDate }) => [startDate, endDate]))
      .toEqual([
        ['2020-02-01', '2020-02-07'],
        ['2020-02-08', '2020-02-14'],
        ['2020-02-15', '2020-02-21'],
        ['2020-02-22', '2020-02-28'],
        ['2020-02-29', '2020-02-29'],
      ])
    expect(planDateHierarchy(range)).toHaveLength(2)
  })

  it('裁剪月内不完整日期段且绝不跨月', () => {
    expect(planSegmentRanges({
      startDate: '2021-04-06',
      endDate: '2021-04-30',
    }).map(({ startDate, endDate }) => [startDate, endDate])).toEqual([
      ['2021-04-06', '2021-04-07'],
      ['2021-04-08', '2021-04-14'],
      ['2021-04-15', '2021-04-21'],
      ['2021-04-22', '2021-04-28'],
      ['2021-04-29', '2021-04-30'],
    ])
    expect(() => planSegmentRanges({
      startDate: '2021-04-30',
      endDate: '2021-05-01',
    })).toThrow()
    expect(() => planYearRanges({
      startDate: '2021-05-01',
      endDate: '2021-04-30',
    })).toThrow()
  })

  it('拒绝越界或无效日期并冻结到启动日', () => {
    expect(() => createFetchDateRange({
      startDate: '2009-08-31',
      startedAtMs,
    })).toThrow()
    expect(() => createFetchDateRange({
      startDate: '2026-08-16',
      startedAtMs,
    })).toThrow()
    expect(() => createFetchDateRange({
      startDate: '2021-02-29',
      startedAtMs,
    })).toThrow()
    expect(createFetchDateRange({ startedAtMs }).endDate).toBe('2026-08-15')
  })

  it('按每页 50 条规划 1 起始页码', () => {
    expect(getPageCount(0)).toBe(0)
    expect(getPageCount(1)).toBe(1)
    expect(getPageCount(50)).toBe(1)
    expect(getPageCount(51)).toBe(2)
    expect(planPageNumbers(101)).toEqual([1, 2, 3])
    expect(() => getPageCount(-1)).toThrow()
    expect(() => getPageCount(1, 0)).toThrow()
  })
})
