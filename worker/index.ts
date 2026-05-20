// Cloudflare Worker entry. Handles /api/suggest by fetching upstream search
// engine suggestion APIs (which don't allow direct browser CORS) and returning
// JSON to the client. Everything else falls through to the static assets.

import { fetchSuggestions } from './engines'

interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> }
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=60',
  'access-control-allow-origin': '*',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/suggest') {
      const engine = url.searchParams.get('engine') ?? ''
      const q = url.searchParams.get('q') ?? ''
      if (!q.trim()) return new Response('[]', { headers: JSON_HEADERS })
      const list = await fetchSuggestions(engine, q)
      return new Response(JSON.stringify(list), { headers: JSON_HEADERS })
    }

    if (url.pathname === '/api/health') {
      return new Response('ok', { headers: { 'content-type': 'text/plain' } })
    }

    return env.ASSETS.fetch(request)
  },
}
