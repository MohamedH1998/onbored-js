type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  constructor(
    private prefix: string = 'Onbored',
    private level: LogLevel = 'info'
  ) {}

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };
    return levels[level] >= levels[this.level];
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug'))
      console.debug(`${this.prefix} [DEBUG] ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info'))
      console.info(`${this.prefix} [INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('warn'))
      console.warn(`${this.prefix} [WARN] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog('error'))
      console.error(`${this.prefix} [ERROR] ${message}`, ...args);
  }
}
