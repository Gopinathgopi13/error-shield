# Error Shield

A comprehensive error handling utility for Node.js & Express.js applications. Provides structured error handling, formatting, and Express.js middleware support.

## Features

- 🎯 **Custom Error Class** - Extendable `AppError` class with status codes and context
- 📦 **Error Formatting** - Consistent error formatting with customizable options
- 🔄 **Async Handler** - Wrapper for async functions to catch errors
- 🚀 **Express Middleware** - Ready-to-use Express.js error handler middleware
- 🛠️ **Error Creators** - Pre-built error creators for common HTTP status codes
- 📝 **TypeScript Support** - Full TypeScript definitions included

## Installation

```bash
npm install error-shield
```

## Usage

### Basic Usage

```javascript
const { AppError, handleError, ErrorCreators } = require("error-shield");

// Create a custom error
const error = new AppError("Something went wrong", 500, "CUSTOM_ERROR", {
  userId: 123,
  action: "updateProfile",
});

// Handle and format error
const errorDetails = handleError(error, {
  includeStack: true,
  includeTimestamp: true,
});

console.log(errorDetails);
```

### Using Error Creators

```javascript
const { ErrorCreators } = require("error-shield");

// Bad Request (400)
throw ErrorCreators.badRequest("Invalid input provided", { field: "email" });

// Unauthorized (401)
throw ErrorCreators.unauthorized("Authentication required");

// Not Found (404)
throw ErrorCreators.notFound("User not found", { userId: 123 });

// Validation Error (422)
throw ErrorCreators.validationError("Email is required", { field: "email" });
```

### Express.js Middleware

```javascript
const express = require("express");
const { expressErrorHandler, ErrorCreators } = require("error-shield");

const app = express();

// Your routes
app.get("/users/:id", async (req, res, next) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    throw ErrorCreators.notFound("User not found", { userId: req.params.id });
  }
  res.json(user);
});

// Error handler middleware (must be last)
app.use(
  expressErrorHandler({
    includeStack: process.env.NODE_ENV !== "production",
    includeTimestamp: true,
  }),
);

app.listen(3000);
```

### Async Handler Wrapper

```javascript
const { asyncHandler } = require("error-shield");

// Wrap async route handlers
app.get(
  "/api/data",
  asyncHandler(async (req, res) => {
    const data = await fetchData();
    res.json(data);
  }),
);
```

### Custom Logger

```javascript
const { handleError } = require("error-shield");

const errorDetails = handleError(error, {
  logger: (errorDetails) => {
    // Custom logging logic
    console.error("Error occurred:", errorDetails);
    // Send to logging service, etc.
  },
});
```

## API Reference

### `AppError`

Custom error class that extends the native `Error` class.

```typescript
class AppError extends Error {
  code?: string;
  statusCode?: number;
  context?: Record<string, any>;
  isOperational: boolean;
}
```

**Constructor:**

- `message: string` - Error message
- `statusCode: number` - HTTP status code (default: 500)
- `code?: string` - Error code
- `context?: Record<string, any>` - Additional context

### `formatError(error, options?)`

Formats an error into a structured object.

**Parameters:**

- `error: Error | AppError` - The error to format
- `options: ErrorHandlerOptions` - Formatting options

**Returns:** `ErrorDetails`

### `handleError(error, options?)`

Handles errors with optional logging and formatting.

**Parameters:**

- `error: Error | AppError` - The error to handle
- `options: ErrorHandlerOptions` - Handler options

**Returns:** `ErrorDetails`

### `asyncHandler(fn)`

Wraps an async function to catch errors.

**Parameters:**

- `fn: Function` - Async function to wrap

**Returns:** Wrapped function

### `expressErrorHandler(options?)`

Creates an Express.js error handler middleware.

**Parameters:**

- `options: ErrorHandlerOptions` - Handler options

**Returns:** Express middleware function

### `ErrorCreators`

Pre-built error creators for all standard HTTP error status codes:

**4xx Client Errors:**

| Method                                            | Code | Default Message                 |
| ------------------------------------------------- | ---- | ------------------------------- |
| `badRequest(message, context?)`                   | 400  | _(required)_                    |
| `unauthorized(message?, context?)`                | 401  | Unauthorized                    |
| `paymentRequired(message?, context?)`             | 402  | Payment Required                |
| `forbidden(message?, context?)`                   | 403  | Forbidden                       |
| `notFound(message?, context?)`                    | 404  | Not Found                       |
| `methodNotAllowed(message?, context?)`            | 405  | Method Not Allowed              |
| `notAcceptable(message?, context?)`               | 406  | Not Acceptable                  |
| `proxyAuthRequired(message?, context?)`           | 407  | Proxy Authentication Required   |
| `requestTimeout(message?, context?)`              | 408  | Request Timeout                 |
| `conflict(message, context?)`                     | 409  | _(required)_                    |
| `gone(message?, context?)`                        | 410  | Gone                            |
| `lengthRequired(message?, context?)`              | 411  | Length Required                 |
| `preconditionFailed(message?, context?)`          | 412  | Precondition Failed             |
| `payloadTooLarge(message?, context?)`             | 413  | Payload Too Large               |
| `uriTooLong(message?, context?)`                  | 414  | URI Too Long                    |
| `unsupportedMediaType(message?, context?)`        | 415  | Unsupported Media Type          |
| `rangeNotSatisfiable(message?, context?)`         | 416  | Range Not Satisfiable           |
| `expectationFailed(message?, context?)`           | 417  | Expectation Failed              |
| `imATeapot(message?, context?)`                   | 418  | I'm a Teapot                    |
| `misdirectedRequest(message?, context?)`          | 421  | Misdirected Request             |
| `unprocessableEntity(message?, context?)`         | 422  | Unprocessable Entity            |
| `validationError(message, context?)`              | 422  | _(required)_                    |
| `locked(message?, context?)`                      | 423  | Locked                          |
| `failedDependency(message?, context?)`            | 424  | Failed Dependency               |
| `tooEarly(message?, context?)`                    | 425  | Too Early                       |
| `upgradeRequired(message?, context?)`             | 426  | Upgrade Required                |
| `preconditionRequired(message?, context?)`        | 428  | Precondition Required           |
| `tooManyRequests(message?, context?)`             | 429  | Too Many Requests               |
| `requestHeaderFieldsTooLarge(message?, context?)` | 431  | Request Header Fields Too Large |
| `unavailableForLegalReasons(message?, context?)`  | 451  | Unavailable For Legal Reasons   |

**5xx Server Errors:**

| Method                                              | Code | Default Message                 |
| --------------------------------------------------- | ---- | ------------------------------- |
| `internalServerError(message?, context?)`           | 500  | Internal Server Error           |
| `notImplemented(message?, context?)`                | 501  | Not Implemented                 |
| `badGateway(message?, context?)`                    | 502  | Bad Gateway                     |
| `serviceUnavailable(message?, context?)`            | 503  | Service Unavailable             |
| `gatewayTimeout(message?, context?)`                | 504  | Gateway Timeout                 |
| `httpVersionNotSupported(message?, context?)`       | 505  | HTTP Version Not Supported      |
| `variantAlsoNegotiates(message?, context?)`         | 506  | Variant Also Negotiates         |
| `insufficientStorage(message?, context?)`           | 507  | Insufficient Storage            |
| `loopDetected(message?, context?)`                  | 508  | Loop Detected                   |
| `bandwidthLimitExceeded(message?, context?)`        | 509  | Bandwidth Limit Exceeded        |
| `notExtended(message?, context?)`                   | 510  | Not Extended                    |
| `networkAuthenticationRequired(message?, context?)` | 511  | Network Authentication Required |
| `networkConnectTimeout(message?, context?)`         | 599  | Network Connect Timeout         |

## TypeScript Support

This package includes full TypeScript definitions:

```typescript
import { AppError, ErrorCreators, handleError } from "error-shield";

const error: AppError = ErrorCreators.notFound("User not found");
const details = handleError(error);
```

## License

ISC

## Author

Gopinath Kathirvel
