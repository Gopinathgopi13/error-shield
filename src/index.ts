/**
 * Error Shield - A comprehensive error handling utility for Node.js & Express.js
 *
 * Provides utilities for error handling, formatting, logging, retry logic,
 * and error chaining with full TypeScript support.
 *
 * @packageDocumentation
 */

// ─── Types & Interfaces ─────────────────────────────────────────────────────

/**
 * Structured representation of an error with optional metadata.
 */
export interface ErrorDetails {
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  timestamp?: string;
  context?: Record<string, any>;
  /** Cause chain information when error chaining is used */
  cause?: ErrorDetails;
}

/**
 * Options for configuring error handling behavior.
 */
export interface ErrorHandlerOptions {
  includeStack?: boolean;
  includeTimestamp?: boolean;
  format?: 'json' | 'string';
  logger?: (error: ErrorDetails) => void;
  context?: Record<string, any>;
}

export type ErrorFn = (message: string, context?: Record<string, any>) => AppError;

export type ErrorMap = Record<string, ErrorFn>;

/**
 * Configuration options for the retry utility.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Backoff strategy between retries (default: 'exponential') */
  backoff?: 'exponential' | 'linear' | 'fixed';
  /** Initial delay in milliseconds before the first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds between retries (default: 30000) */
  maxDelay?: number;
  /**
   * Optional predicate to determine whether a retry should be attempted.
   * If provided and returns `false`, the error is thrown immediately.
   */
  retryIf?: (error: Error) => boolean;
  /** Optional callback invoked before each retry attempt */
  onRetry?: (error: Error, attempt: number) => void;
  /** Whether to add random jitter to the delay to prevent thundering herd (default: true) */
  jitter?: boolean;
}

// ─── AppError Class ──────────────────────────────────────────────────────────

/**
 * Custom Error class with additional properties for structured error handling.
 *
 * Supports error chaining via the native ES2022 `Error.cause` feature.
 *
 * @example
 * ```ts
 * const error = new AppError('Something broke', 500, 'INTERNAL', { userId: 123 });
 *
 * // With error chaining
 * try {
 *   await fetchData();
 * } catch (err) {
 *   throw new AppError('Failed to fetch data', 502, 'FETCH_FAILED', undefined, err);
 * }
 * ```
 */
export class AppError extends Error {
  public code?: string;
  public statusCode?: number;
  public context?: Record<string, any>;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    context?: Record<string, any>,
    cause?: Error
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
    this.isOperational = true;
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Wraps an existing error as the cause of a new `AppError`.
   *
   * This is a convenience factory for error chaining — it creates a new
   * `AppError` whose `.cause` is set to the original error.
   *
   * @param originalError - The caught error to wrap
   * @param message - Human-readable description of the higher-level failure
   * @param statusCode - HTTP status code (default: 500)
   * @param code - Machine-readable error code
   * @param context - Additional context metadata
   * @returns A new `AppError` with `originalError` as its cause
   *
   * @example
   * ```ts
   * try {
   *   await db.query('SELECT ...');
   * } catch (err) {
   *   throw AppError.wrap(err, 'Database query failed', 500, 'DB_ERROR');
   * }
   * ```
   */
  static wrap(
    originalError: Error,
    message: string,
    statusCode: number = 500,
    code?: string,
    context?: Record<string, any>
  ): AppError {
    return new AppError(message, statusCode, code, context, originalError);
  }
}

// ─── Core Utilities ──────────────────────────────────────────────────────────

/**
 * Formats an error into a structured {@link ErrorDetails} object.
 *
 * When the error has a `.cause`, the cause chain is recursively formatted
 * and included in the output.
 */
export function formatError(
  error: Error | AppError,
  options: ErrorHandlerOptions = {}
): ErrorDetails {
  const {
    includeStack = false,
    includeTimestamp = true,
    context: optionsContext = {},
  } = options;

  const mergedContext = error instanceof AppError
    ? { ...error.context, ...optionsContext }
    : optionsContext;

  const errorDetails: ErrorDetails = {
    message: error.message,
    ...(includeTimestamp && { timestamp: new Date().toISOString() }),
    ...(includeStack && error.stack && { stack: error.stack }),
    ...(error instanceof AppError && {
      code: error.code,
      statusCode: error.statusCode,
    }),
    ...(Object.keys(mergedContext).length > 0 && { context: mergedContext }),
  };

  // Recursively format the cause chain
  if (error.cause && error.cause instanceof Error) {
    errorDetails.cause = formatError(error.cause, {
      includeStack,
      includeTimestamp: false, // only top-level gets timestamp
    });
  }

  return errorDetails;
}

/**
 * Handles errors with optional logging and formatting.
 */
export function handleError(
  error: Error | AppError,
  options: ErrorHandlerOptions = {}
): ErrorDetails {
  const errorDetails = formatError(error, options);

  if (options.logger) {
    options.logger(errorDetails);
  }

  return errorDetails;
}

/**
 * Async error wrapper — catches errors from async route handlers
 * and forwards them to Express's `next()` function.
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return ((...args: any[]) => {
    return Promise.resolve(fn(...args)).catch((error) => {
      throw error;
    });
  }) as T;
}

/**
 * Express.js error handler middleware factory.
 *
 * Returns a standard Express error-handling middleware that formats
 * the error and sends an appropriate JSON or string response.
 */
export function expressErrorHandler(
  options: ErrorHandlerOptions = {}
) {
  return (
    err: Error | AppError,
    req: any,
    res: any,
    next: any
  ): void => {
    const errorDetails = handleError(err, {
      ...options,
      context: {
        ...options.context,
        method: req.method,
        path: req.path,
        ip: req.ip,
      },
    });

    const statusCode =
      err instanceof AppError ? err.statusCode || 500 : 500;

    if (options.format === 'string') {
      res.status(statusCode).send(errorDetails.message);
    } else {
      res.status(statusCode).json(errorDetails);
    }
  };
}

/**
 * Creates a standardized error response.
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  context?: Record<string, any>
): AppError {
  return new AppError(message, statusCode, code, context);
}

// ─── Retry Utility ───────────────────────────────────────────────────────────

/**
 * Calculates the delay for a given retry attempt based on the backoff strategy.
 * @internal
 */
function calculateDelay(
  attempt: number,
  options: Required<Pick<RetryOptions, 'backoff' | 'initialDelay' | 'maxDelay' | 'jitter'>>
): number {
  const { backoff, initialDelay, maxDelay, jitter } = options;

  let delay: number;

  switch (backoff) {
    case 'exponential':
      delay = initialDelay * Math.pow(2, attempt - 1);
      break;
    case 'linear':
      delay = initialDelay * attempt;
      break;
    case 'fixed':
      delay = initialDelay;
      break;
    default:
      delay = initialDelay;
  }

  // Cap at maxDelay
  delay = Math.min(delay, maxDelay);

  // Add jitter (±25% randomness)
  if (jitter) {
    const jitterAmount = delay * 0.25;
    delay = delay - jitterAmount + Math.random() * jitterAmount * 2;
  }

  return Math.round(delay);
}

/**
 * Executes an async function with automatic retries on failure.
 *
 * Supports exponential, linear, and fixed backoff strategies with
 * optional jitter, conditional retry predicates, and retry callbacks.
 *
 * If all retries are exhausted, the **last** error is thrown. The previous
 * attempt errors are accessible via the error's `.cause` chain and the
 * `attempts` property attached to the final error.
 *
 * @typeParam T - The return type of the async function
 * @param fn - The async function to execute with retries
 * @param options - Retry configuration options
 * @returns The result of the successful function execution
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetch('https://api.example.com/data').then(r => r.json()),
 *   {
 *     maxRetries: 5,
 *     backoff: 'exponential',
 *     initialDelay: 500,
 *     retryIf: (err) => err.message.includes('ECONNREFUSED'),
 *     onRetry: (err, attempt) => console.log(`Retry ${attempt}: ${err.message}`),
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    backoff = 'exponential',
    initialDelay = 1000,
    maxDelay = 30000,
    retryIf,
    onRetry,
    jitter = true,
  } = options;

  const errors: Error[] = [];
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      errors.push(error);

      // If this was the last attempt, break to throw
      if (attempt === maxRetries) {
        break;
      }

      // Check retryIf predicate
      if (retryIf && !retryIf(error)) {
        break;
      }

      // Invoke onRetry callback
      if (onRetry) {
        onRetry(error, attempt + 1);
      }

      // Wait before retrying
      const delay = calculateDelay(attempt + 1, {
        backoff,
        initialDelay,
        maxDelay,
        jitter,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Attach attempt history to the final error
  const finalError = lastError!;
  (finalError as any).attempts = errors;

  throw finalError;
}

// ─── Common Error Creators ───────────────────────────────────────────────────

/**
 * Pre-built factory functions for common HTTP error responses.
 *
 * @example
 * ```ts
 * throw Errors.notFound('User not found', { userId: 42 });
 * throw Errors.unauthorized();
 * throw Errors.tooManyRequests('Rate limit exceeded');
 * ```
 */
export const Errors: ErrorMap = {
  // 4xx Client Errors
  badRequest: (message: string, context?: Record<string, any>) =>
    new AppError(message, 400, 'BAD_REQUEST', context),

  unauthorized: (message: string = 'Unauthorized', context?: Record<string, any>) =>
    new AppError(message, 401, 'UNAUTHORIZED', context),

  paymentRequired: (message: string = 'Payment Required', context?: Record<string, any>) =>
    new AppError(message, 402, 'PAYMENT_REQUIRED', context),

  forbidden: (message: string = 'Forbidden', context?: Record<string, any>) =>
    new AppError(message, 403, 'FORBIDDEN', context),

  notFound: (message: string = 'Not Found', context?: Record<string, any>) =>
    new AppError(message, 404, 'NOT_FOUND', context),

  methodNotAllowed: (message: string = 'Method Not Allowed', context?: Record<string, any>) =>
    new AppError(message, 405, 'METHOD_NOT_ALLOWED', context),

  notAcceptable: (message: string = 'Not Acceptable', context?: Record<string, any>) =>
    new AppError(message, 406, 'NOT_ACCEPTABLE', context),

  proxyAuthRequired: (message: string = 'Proxy Authentication Required', context?: Record<string, any>) =>
    new AppError(message, 407, 'PROXY_AUTH_REQUIRED', context),

  requestTimeout: (message: string = 'Request Timeout', context?: Record<string, any>) =>
    new AppError(message, 408, 'REQUEST_TIMEOUT', context),

  conflict: (message: string, context?: Record<string, any>) =>
    new AppError(message, 409, 'CONFLICT', context),

  gone: (message: string = 'Gone', context?: Record<string, any>) =>
    new AppError(message, 410, 'GONE', context),

  lengthRequired: (message: string = 'Length Required', context?: Record<string, any>) =>
    new AppError(message, 411, 'LENGTH_REQUIRED', context),

  preconditionFailed: (message: string = 'Precondition Failed', context?: Record<string, any>) =>
    new AppError(message, 412, 'PRECONDITION_FAILED', context),

  payloadTooLarge: (message: string = 'Payload Too Large', context?: Record<string, any>) =>
    new AppError(message, 413, 'PAYLOAD_TOO_LARGE', context),

  uriTooLong: (message: string = 'URI Too Long', context?: Record<string, any>) =>
    new AppError(message, 414, 'URI_TOO_LONG', context),

  unsupportedMediaType: (message: string = 'Unsupported Media Type', context?: Record<string, any>) =>
    new AppError(message, 415, 'UNSUPPORTED_MEDIA_TYPE', context),

  rangeNotSatisfiable: (message: string = 'Range Not Satisfiable', context?: Record<string, any>) =>
    new AppError(message, 416, 'RANGE_NOT_SATISFIABLE', context),

  expectationFailed: (message: string = 'Expectation Failed', context?: Record<string, any>) =>
    new AppError(message, 417, 'EXPECTATION_FAILED', context),

  imATeapot: (message: string = "I'm a Teapot", context?: Record<string, any>) =>
    new AppError(message, 418, 'IM_A_TEAPOT', context),

  misdirectedRequest: (message: string = 'Misdirected Request', context?: Record<string, any>) =>
    new AppError(message, 421, 'MISDIRECTED_REQUEST', context),

  unprocessableEntity: (message: string = 'Unprocessable Entity', context?: Record<string, any>) =>
    new AppError(message, 422, 'UNPROCESSABLE_ENTITY', context),

  validationError: (message: string, context?: Record<string, any>) =>
    new AppError(message, 422, 'VALIDATION_ERROR', context),

  locked: (message: string = 'Locked', context?: Record<string, any>) =>
    new AppError(message, 423, 'LOCKED', context),

  failedDependency: (message: string = 'Failed Dependency', context?: Record<string, any>) =>
    new AppError(message, 424, 'FAILED_DEPENDENCY', context),

  tooEarly: (message: string = 'Too Early', context?: Record<string, any>) =>
    new AppError(message, 425, 'TOO_EARLY', context),

  upgradeRequired: (message: string = 'Upgrade Required', context?: Record<string, any>) =>
    new AppError(message, 426, 'UPGRADE_REQUIRED', context),

  preconditionRequired: (message: string = 'Precondition Required', context?: Record<string, any>) =>
    new AppError(message, 428, 'PRECONDITION_REQUIRED', context),

  tooManyRequests: (message: string = 'Too Many Requests', context?: Record<string, any>) =>
    new AppError(message, 429, 'TOO_MANY_REQUESTS', context),

  requestHeaderFieldsTooLarge: (message: string = 'Request Header Fields Too Large', context?: Record<string, any>) =>
    new AppError(message, 431, 'REQUEST_HEADER_FIELDS_TOO_LARGE', context),

  unavailableForLegalReasons: (message: string = 'Unavailable For Legal Reasons', context?: Record<string, any>) =>
    new AppError(message, 451, 'UNAVAILABLE_FOR_LEGAL_REASONS', context),

  // 5xx Server Errors
  internalServerError: (message: string = 'Internal Server Error', context?: Record<string, any>) =>
    new AppError(message, 500, 'INTERNAL_SERVER_ERROR', context),

  notImplemented: (message: string = 'Not Implemented', context?: Record<string, any>) =>
    new AppError(message, 501, 'NOT_IMPLEMENTED', context),

  badGateway: (message: string = 'Bad Gateway', context?: Record<string, any>) =>
    new AppError(message, 502, 'BAD_GATEWAY', context),

  serviceUnavailable: (message: string = 'Service Unavailable', context?: Record<string, any>) =>
    new AppError(message, 503, 'SERVICE_UNAVAILABLE', context),

  gatewayTimeout: (message: string = 'Gateway Timeout', context?: Record<string, any>) =>
    new AppError(message, 504, 'GATEWAY_TIMEOUT', context),

  httpVersionNotSupported: (message: string = 'HTTP Version Not Supported', context?: Record<string, any>) =>
    new AppError(message, 505, 'HTTP_VERSION_NOT_SUPPORTED', context),

  variantAlsoNegotiates: (message: string = 'Variant Also Negotiates', context?: Record<string, any>) =>
    new AppError(message, 506, 'VARIANT_ALSO_NEGOTIATES', context),

  insufficientStorage: (message: string = 'Insufficient Storage', context?: Record<string, any>) =>
    new AppError(message, 507, 'INSUFFICIENT_STORAGE', context),

  loopDetected: (message: string = 'Loop Detected', context?: Record<string, any>) =>
    new AppError(message, 508, 'LOOP_DETECTED', context),

  bandwidthLimitExceeded: (message: string = 'Bandwidth Limit Exceeded', context?: Record<string, any>) =>
    new AppError(message, 509, 'BANDWIDTH_LIMIT_EXCEEDED', context),

  notExtended: (message: string = 'Not Extended', context?: Record<string, any>) =>
    new AppError(message, 510, 'NOT_EXTENDED', context),

  networkAuthenticationRequired: (message: string = 'Network Authentication Required', context?: Record<string, any>) =>
    new AppError(message, 511, 'NETWORK_AUTHENTICATION_REQUIRED', context),

  networkConnectTimeout: (message: string = 'Network Connect Timeout', context?: Record<string, any>) =>
    new AppError(message, 599, 'NETWORK_CONNECT_TIMEOUT', context),
};

// Default export
export default {
  AppError,
  formatError,
  handleError,
  asyncHandler,
  expressErrorHandler,
  createErrorResponse,
  withRetry,
  Errors,
};
