import http from 'node:http'
import { describe, expect, it } from 'vitest'

describe('离线测试守卫', () => {
  it('阻止上层和底层网络请求离开进程', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow('Offline test attempted to access the network')
    expect(() => http.get('https://example.com')).toThrow('Offline test attempted to access the network')
  })
})
