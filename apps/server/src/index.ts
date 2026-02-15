import express from 'express'
import { createServer } from 'http'
import { resolve, join, dirname } from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { env, printStartupBanner } from './config/env.js'
import { errorHandler } from './middleware/error.js'
import routes from './routes/index.js'
import { setupCollaborationSocket } from './websocket/collaboration.js'
import { tokenService } from './services/token.service.js'

const app = express()
const httpServer = createServer(app)

if (env.TRUST_PROXY) {
  app.set('trust proxy', env.TRUST_PROXY)
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}))
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
)

app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
  })
)

app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' } },
  })
)

app.use(
  '/api/auth/register',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many registration attempts, please try again later' } },
  })
)

app.use(express.json({ limit: `${env.MAX_UPLOAD_SIZE_MB}mb` }))
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api', (_req, res) => {
  res.json({
    name: 'Onyka API',
    version: '0.1.0',
  })
})

app.use('/api', routes)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const clientDistPath = resolve(__dirname, '../../web/dist')
if (process.env.NODE_ENV === 'production' && existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, {
    maxAge: '1y',
    immutable: true,
    index: false,
  }))

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next()
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.sendFile(join(clientDistPath, 'index.html'))
  })
}

app.use(errorHandler)

setupCollaborationSocket(httpServer)

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled promise rejection:', reason)
})

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught exception — shutting down gracefully:', error)
  httpServer.close(() => {
    process.exit(1)
  })
  setTimeout(() => process.exit(1), 5000).unref()
})

setInterval(() => {
  tokenService.cleanupExpiredTokens().catch(() => {})
}, 6 * 60 * 60 * 1000).unref()

httpServer.listen(env.PORT, async () => {
  printStartupBanner()
  console.log(`  Onyka running on http://localhost:${env.PORT}`)
  console.log(`  WebSocket enabled for real-time collaboration`)
  console.log('')

  // Reindex FTS if the table was recreated (schema migration from contentless)
  const { ftsNeedsReindex } = await import('./db/index.js')
  if (ftsNeedsReindex) {
    const { adminService } = await import('./services/admin.service.js')
    const result = await adminService.reindexSearch()
    console.log(`FTS reindex complete: ${result.indexedCount} notes indexed`)
  }
})
