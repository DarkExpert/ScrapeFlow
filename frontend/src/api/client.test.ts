import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, allPages, api } from './client'

afterEach(() => vi.unstubAllGlobals())

describe('API client', () => {
  it('reads real stats from the backend route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ sources: 2, records: 5, versions: 6, runs: 3, recent_runs: [] }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await api.stats()).records).toBe(5)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/stats', expect.any(Object))
  })

  it('turns validation details into a readable message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ loc: ['body', 'config', 'fields'], msg: 'Field required' }] }), { status: 422 })))
    await expect(api.createSource({ name: 'Bad', kind: 'json', url: 'https://example.com', config: { kind: 'json', fields: {} }, enabled: true })).rejects.toThrow('config.fields: Field required')
  })

  it('reports an unavailable API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network failure')))
    await expect(api.stats()).rejects.toBeInstanceOf(ApiError)
    await expect(api.stats()).rejects.toThrow('Cannot connect to the ScrapeFlow API')
  })

  it('explains a failed development proxy response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))
    await expect(api.stats()).rejects.toThrow('Cannot connect to the ScrapeFlow API')
  })

  it('collects every backend page without inventing a larger page size', async () => {
    const load = vi.fn().mockResolvedValueOnce({ items: [1, 2], total: 3, limit: 2, offset: 0 }).mockResolvedValueOnce({ items: [3], total: 3, limit: 2, offset: 2 })
    expect(await allPages(load)).toEqual([1, 2, 3])
    expect(load.mock.calls.map((call) => call[0])).toEqual([0, 2])
  })
})

