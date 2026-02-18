/**
 * Comprehensive Logging System for ML Task Scheduler
 * Supports multiple log levels, structured logging, and log aggregation
 */

import fs from 'fs';
import path from 'path';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
}

interface LoggerConfig {
  service: string;
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: number; // bytes
  maxFiles?: number;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
};

class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      service: config.service || 'task-scheduler-backend',
      level: config.level || (process.env.LOG_LEVEL as LogLevel) || 'INFO',
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? process.env.NODE_ENV === 'production',
      filePath: config.filePath || './logs',
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles || 5,
    };

    // Start flush interval for batched file writing
    if (this.config.enableFile) {
      this.ensureLogDirectory();
      this.flushInterval = setInterval(() => this.flush(), 5000);
    }
  }

  private ensureLogDirectory() {
    if (this.config.filePath && !fs.existsSync(this.config.filePath)) {
      fs.mkdirSync(this.config.filePath, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatEntry(entry: LogEntry): string {
    const base = `[${entry.timestamp}] [${entry.level}] [${entry.service}]`;
    const reqId = entry.requestId ? ` [req:${entry.requestId}]` : '';
    const userId = entry.userId ? ` [user:${entry.userId}]` : '';
    const meta = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';
    const stack = entry.stack ? `\n${entry.stack}` : '';
    
    return `${base}${reqId}${userId} ${entry.message}${meta}${stack}`;
  }

  private colorize(level: LogLevel, text: string): string {
    const colors: Record<LogLevel, string> = {
      DEBUG: '\x1b[36m', // cyan
      INFO: '\x1b[32m',  // green
      WARN: '\x1b[33m',  // yellow
      ERROR: '\x1b[31m', // red
      FATAL: '\x1b[35m', // magenta
    };
    const reset = '\x1b[0m';
    return `${colors[level]}${text}${reset}`;
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    requestId?: string,
    userId?: string
  ) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      requestId,
      userId,
      metadata,
    };

    // Console output
    if (this.config.enableConsole) {
      const formatted = this.formatEntry(entry);
      const colorized = this.colorize(level, formatted);
      
      if (level === 'ERROR' || level === 'FATAL') {
        console.error(colorized);
      } else if (level === 'WARN') {
        console.warn(colorized);
      } else {
        console.log(colorized);
      }
    }

    // Buffer for file output
    if (this.config.enableFile) {
      this.logBuffer.push(entry);
    }
  }

  private flush() {
    if (this.logBuffer.length === 0) return;

    const entries = this.logBuffer.splice(0);
    const date = new Date().toISOString().split('T')[0];
    const filename = path.join(this.config.filePath!, `app-${date}.log`);

    const content = entries
      .map(e => JSON.stringify(e))
      .join('\n') + '\n';

    fs.appendFile(filename, content, (err) => {
      if (err) {
        console.error('Failed to write log file:', err);
      }
    });
  }

  // Public logging methods
  debug(message: string, metadata?: Record<string, unknown>, requestId?: string, userId?: string) {
    this.log('DEBUG', message, metadata, requestId, userId);
  }

  info(message: string, metadata?: Record<string, unknown>, requestId?: string, userId?: string) {
    this.log('INFO', message, metadata, requestId, userId);
  }

  warn(message: string, metadata?: Record<string, unknown>, requestId?: string, userId?: string) {
    this.log('WARN', message, metadata, requestId, userId);
  }

  error(message: string, error?: Error | unknown, metadata?: Record<string, unknown>, requestId?: string, userId?: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      service: this.config.service,
      requestId,
      userId,
      metadata: {
        ...metadata,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (this.config.enableConsole) {
      console.error(this.colorize('ERROR', this.formatEntry(entry)));
    }

    if (this.config.enableFile) {
      this.logBuffer.push(entry);
    }
  }

  fatal(message: string, error?: Error | unknown, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'FATAL',
      message,
      service: this.config.service,
      metadata: {
        ...metadata,
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      stack: error instanceof Error ? error.stack : undefined,
    };

    if (this.config.enableConsole) {
      console.error(this.colorize('FATAL', this.formatEntry(entry)));
    }

    if (this.config.enableFile) {
      this.logBuffer.push(entry);
      this.flush(); // Immediately flush fatal errors
    }
  }

  // HTTP request logging
  request(method: string, path: string, statusCode: number, duration: number, requestId?: string, userId?: string) {
    const level: LogLevel = statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO';
    this.log(level, `${method} ${path} ${statusCode} ${duration}ms`, { method, path, statusCode, duration }, requestId, userId);
  }

  // Graceful shutdown
  shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

// Singleton instance
const logger = new Logger();

// Request logging middleware
export const requestLogger = () => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Attach requestId to request
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - start;
      const userId = req.user?.id;
      logger.request(req.method, req.path, res.statusCode, duration, requestId, userId);
    });

    next();
  };
};

export default logger;
