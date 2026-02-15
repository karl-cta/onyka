type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel]
}

const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'newPassword', 'currentPassword',
  'token', 'accessToken', 'refreshToken', 'secret',
  'authorization', 'cookie', 'code', 'codeHash',
  'otp', 'pin', 'creditCard', 'ssn',
])

function redactSensitive(obj: LogContext): LogContext {
  const redacted: LogContext = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]'
    } else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error)) {
      redacted[key] = redactSensitive(value as LogContext)
    } else {
      redacted[key] = value
    }
  }
  return redacted
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const contextStr = context ? ` ${JSON.stringify(redactSensitive(context))}` : ''
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      console.debug(formatMessage('debug', message, context))
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      console.info(formatMessage('info', message, context))
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, context))
    }
  },

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (shouldLog('error')) {
      const errorContext = error instanceof Error
        ? { ...context, errorMessage: error.message, stack: error.stack }
        : { ...context, error }
      console.error(formatMessage('error', message, errorContext))
    }
  },
}
