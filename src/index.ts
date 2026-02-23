/**
 * Error Handler - A comprehensive error handling utility for Node.js
 * 
 * Provides utilities for error handling, formatting, and logging
 */

export interface ErrorDetails {
  message: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  timestamp?: string;
  context?: Record<string, any>;
}

export interface ErrorHandlerOptions {
  includeStack?: boolean;
  includeTimestamp?: boolean;
  format?: 'json' | 'string';
  logger?: (error: ErrorDetails) => void;
  context?: Record<string, any>;
}

/**
 * Custom Error class with additional properties
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
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.context = context;
    this.isOperational = true;
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Formats an error into a structured object
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

  return errorDetails;
}

/**
 * Handles errors with optional logging and formatting
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
 * Async error wrapper - catches errors from async functions
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
 * Express.js error handler middleware
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
 * Creates a standardized error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  context?: Record<string, any>
): AppError {
  return new AppError(message, statusCode, code, context);
}

/**
 * Common error creators
 */
export const ErrorCreators = {
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
  ErrorCreators,
};
