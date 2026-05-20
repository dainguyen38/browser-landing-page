import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fetchSuggestions } from './worker/engines'

function suggestProxy(): Plugin {
  return {
    name: 'suggest-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/suggest')) return next()
        try {
          const url = new URL(req.url, 'http://localhost')
          const engine = url.searchParams.get('engine') ?? ''
          const q = url.searchParams.get('q') ?? ''
          const list = q.trim() ? await fetchSuggestions(engine, q) : []
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'public, max-age=60')
          res.statusCode = 200
          res.end(JSON.stringify(list))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), suggestProxy()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
