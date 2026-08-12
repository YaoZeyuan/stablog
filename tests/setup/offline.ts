import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { afterEach, beforeEach, vi } from 'vitest'

const offlineError = () => new Error('Offline test attempted to access the network')

beforeEach(() => {
  if (typeof globalThis.fetch === 'function') {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(offlineError())
  }
  vi.spyOn(http, 'request').mockImplementation((() => {
    throw offlineError()
  }) as typeof http.request)
  vi.spyOn(http, 'get').mockImplementation((() => {
    throw offlineError()
  }) as typeof http.get)
  vi.spyOn(https, 'request').mockImplementation((() => {
    throw offlineError()
  }) as typeof https.request)
  vi.spyOn(https, 'get').mockImplementation((() => {
    throw offlineError()
  }) as typeof https.get)
  vi.spyOn(net, 'connect').mockImplementation((() => {
    throw offlineError()
  }) as typeof net.connect)
  vi.spyOn(net, 'createConnection').mockImplementation((() => {
    throw offlineError()
  }) as typeof net.createConnection)
})

afterEach(() => {
  vi.restoreAllMocks()
})

