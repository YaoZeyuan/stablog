import http from 'node:http'
import { describe, expect, it } from 'vitest'

describe('离线测试守卫', () => {
  it('阻止 fetch 与 Node HTTP 请求离开进程', async () => {
    await expect(fetch('https://example.com')).rejects.toThrow('Offline test attempted to access the network')
    expect(() => http.get('https://example.com')).toThrow('Offline test attempted to access the network')
  })
})
