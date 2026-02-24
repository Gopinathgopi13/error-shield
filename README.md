<div align="center">

# 🛡️ Error Shield

### Elegant, structured error handling for Node.js & Express.js

[![npm version](https://img.shields.io/npm/v/error-shield?style=for-the-badge&color=cb3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/error-shield)
[![License](https://img.shields.io/npm/l/error-shield?style=for-the-badge&color=blue)](https://github.com/Gopinathgopi13/error-shield/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D14-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Downloads](https://img.shields.io/npm/dt/error-shield?style=for-the-badge&color=brightgreen&logo=npm)](https://www.npmjs.com/package/error-shield)

**Stop writing repetitive error handling code.** Error Shield gives you a battle-tested toolkit —  
custom error classes, async wrappers, Express middleware, and 40+ HTTP error creators — out of the box.

[Get Started](#-quick-start) · [API Reference](#-api-reference) · [Examples](#-usage-examples) · [Contributing](#-contributing)

</div>

---

## ✨ Why Error Shield?

| Pain Point                                        | How Error Shield Helps                              |
| :------------------------------------------------ | :-------------------------------------------------- |
| ❌ Inconsistent error responses across routes     | ✅ Uniform `ErrorDetails` structure everywhere      |
| ❌ Boilerplate `try/catch` in every async handler | ✅ `asyncHandler()` wraps it for you                |
| ❌ Manually setting status codes & messages       | ✅ 40+ pre-built `ErrorCreators` with correct codes |
| ❌ No context attached to errors for debugging    | ✅ `AppError` carries structured `context` data     |
| ❌ Missing TypeScript types for errors            | ✅ Full type definitions included                   |

---

## 📦 Installation

```bash
# npm
npm install error-shield

# yarn
yarn add error-shield

# pnpm
pnpm add error-shield
```

---

## ⚡ Quick Start

Get up and running in **under 60 seconds**:

```javascript
const {
  AppError,
  handleError,
  ErrorCreators,
  expressErrorHandler,
  asyncHandler,
} = require("error-shield");

// 1️⃣ Throw meaningful errors
throw ErrorCreators.notFound("User not found", { userId: 42 });

// 2️⃣ Handle & format any error
const details = handleError(new Error("Oops"), { includeStack: true });

// 3️⃣ Plug into Express with one line
app.use(expressErrorHandler({ includeTimestamp: true }));
```

That's it — structured errors, formatted output, and Express integration with zero boilerplate. 🎉

---

## 📖 Table of Contents

- [Why Error Shield?](#-why-error-shield)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Usage Examples](#-usage-examples)
  - [Custom Errors with `AppError`](#1%EF%B8%8F⃣-custom-errors-with-apperror)
  - [Error Creators](#2%EF%B8%8F⃣-error-creators)
  - [Express.js Middleware](#3%EF%B8%8F⃣-expressjs-middleware)
  - [Async Handler Wrapper](#4%EF%B8%8F⃣-async-handler-wrapper)
  - [Custom Logger](#5%EF%B8%8F⃣-custom-logger)
- [API Reference](#-api-reference)
- [Error Creators — Full Reference](#-error-creators--full-reference)
- [TypeScript Support](#-typescript-support)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Usage Examples

### 1️⃣ Custom Errors with `AppError`

Create rich, structured errors with status codes, error codes, and arbitrary context:

```javascript
const { AppError, handleError } = require("error-shield");

const error = new AppError("Something went wrong", 500, "CUSTOM_ERROR", {
  userId: 123,
  action: "updateProfile",
});

const errorDetails = handleError(error, {
  includeStack: true,
  includeTimestamp: true,
});

console.log(errorDetails);
```

<details>
<summary>📋 <strong>Example Output</strong></summary>

```json
{
  "message": "Something went wrong",
  "statusCode": 500,
  "code": "CUSTOM_ERROR",
  "context": {
    "userId": 123,
    "action": "updateProfile"
  },
  "isOperational": true,
  "timestamp": "2026-02-24T10:30:00.000Z",
  "stack": "Error: Something went wrong\n    at ..."
}
```

</details>

---

### 2️⃣ Error Creators

Use pre-built error factories for common HTTP errors — no need to memorize status codes:

```javascript
const { ErrorCreators } = require("error-shield");

// 🔴 400 — Bad Request
throw ErrorCreators.badRequest("Invalid input provided", { field: "email" });

// 🔒 401 — Unauthorized
throw ErrorCreators.unauthorized("Authentication required");

// 🔍 404 — Not Found
throw ErrorCreators.notFound("User not found", { userId: 123 });

// ✏️ 422 — Validation Error
throw ErrorCreators.validationError("Email is required", { field: "email" });

// 🚦 429 — Too Many Requests
throw ErrorCreators.tooManyRequests("Rate limit exceeded", { retryAfter: 60 });

// 💥 500 — Internal Server Error
throw ErrorCreators.internalServerError("Unexpected failure");
```

---

### 3️⃣ Express.js Middleware

Plug in a production-ready error handler with a single line:

```javascript
const express = require("express");
const {
  expressErrorHandler,
  asyncHandler,
  ErrorCreators,
} = require("error-shield");

const app = express();

// Your routes — errors are automatically caught & forwarded
app.get(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) {
      throw ErrorCreators.notFound("User not found", { userId: req.params.id });
    }
    res.json(user);
  }),
);

// ⬇️ Error handler middleware (must be last)
app.use(
  expressErrorHandler({
    includeStack: process.env.NODE_ENV !== "production",
    includeTimestamp: true,
  }),
);

app.listen(3000, () => console.log("🚀 Server running on port 3000"));
```

> **💡 Tip:** Combine `asyncHandler` with `expressErrorHandler` for completely boilerplate-free async route error handling.

---

### 4️⃣ Async Handler Wrapper

Eliminate `try/catch` blocks in your async route handlers:

```javascript
const { asyncHandler } = require("error-shield");

// ❌ Without asyncHandler
app.get("/api/data", async (req, res, next) => {
  try {
    const data = await fetchData();
    res.json(data);
  } catch (err) {
    next(err); // easy to forget!
  }
});

// ✅ With asyncHandler — clean & safe
app.get(
  "/api/data",
  asyncHandler(async (req, res) => {
    const data = await fetchData();
    res.json(data);
  }),
);
```

---

### 5️⃣ Custom Logger

Attach your own logging logic — send errors to Sentry, Datadog, or any external service:

```javascript
const { handleError } = require("error-shield");

const errorDetails = handleError(error, {
  logger: (details) => {
    console.error("[ERROR]", details.message);
    // 📤 Send to your logging service
    Sentry.captureException(details);
  },
});
```

---

## 📚 API Reference

### `AppError` class

> Extends the native `Error` class with structured metadata.

```typescript
class AppError extends Error {
  code?: string;
  statusCode?: number;
  context?: Record<string, any>;
  isOperational: boolean;
}
```

| Parameter    | Type                  | Default | Description                  |
| :----------- | :-------------------- | :-----: | :--------------------------- |
| `message`    | `string`              |    —    | Error message                |
| `statusCode` | `number`              |  `500`  | HTTP status code             |
| `code`       | `string`              |    —    | Machine-readable error code  |
| `context`    | `Record<string, any>` |    —    | Additional debugging context |

---

### `formatError(error, options?)`

> Formats any error into a consistent `ErrorDetails` object.

| Parameter | Type                  | Description         |
| :-------- | :-------------------- | :------------------ |
| `error`   | `Error \| AppError`   | The error to format |
| `options` | `ErrorHandlerOptions` | Formatting options  |

**Returns:** `ErrorDetails`

---

### `handleError(error, options?)`

> Handles errors with optional logging and formatting.

| Parameter | Type                  | Description                                                             |
| :-------- | :-------------------- | :---------------------------------------------------------------------- |
| `error`   | `Error \| AppError`   | The error to handle                                                     |
| `options` | `ErrorHandlerOptions` | Handler options (includes `logger`, `includeStack`, `includeTimestamp`) |

**Returns:** `ErrorDetails`

---

### `asyncHandler(fn)`

> Wraps an async Express route handler to automatically catch rejected promises.

| Parameter | Type                               | Description                  |
| :-------- | :--------------------------------- | :--------------------------- |
| `fn`      | `(req, res, next) => Promise<any>` | Async route handler function |

**Returns:** Wrapped Express middleware function

---

### `expressErrorHandler(options?)`

> Creates an Express.js error-handling middleware.

| Parameter | Type                  | Description     |
| :-------- | :-------------------- | :-------------- |
| `options` | `ErrorHandlerOptions` | Handler options |

**Returns:** Express error middleware `(err, req, res, next) => void`

---

## 🗂️ Error Creators — Full Reference

Pre-built factory methods for **all standard HTTP error codes**. Every method returns an `AppError` instance.

```javascript
// Signature for all creators:
ErrorCreators.methodName(message?, context?)
// → Returns: AppError
```

<details>
<summary>🟠 <strong>4xx Client Errors</strong> <em>(click to expand)</em></summary>

| Method                                            | Code  | Default Message                 |
| :------------------------------------------------ | :---: | :------------------------------ |
| `badRequest(message, context?)`                   | `400` | _(required)_                    |
| `unauthorized(message?, context?)`                | `401` | Unauthorized                    |
| `paymentRequired(message?, context?)`             | `402` | Payment Required                |
| `forbidden(message?, context?)`                   | `403` | Forbidden                       |
| `notFound(message?, context?)`                    | `404` | Not Found                       |
| `methodNotAllowed(message?, context?)`            | `405` | Method Not Allowed              |
| `notAcceptable(message?, context?)`               | `406` | Not Acceptable                  |
| `proxyAuthRequired(message?, context?)`           | `407` | Proxy Authentication Required   |
| `requestTimeout(message?, context?)`              | `408` | Request Timeout                 |
| `conflict(message, context?)`                     | `409` | _(required)_                    |
| `gone(message?, context?)`                        | `410` | Gone                            |
| `lengthRequired(message?, context?)`              | `411` | Length Required                 |
| `preconditionFailed(message?, context?)`          | `412` | Precondition Failed             |
| `payloadTooLarge(message?, context?)`             | `413` | Payload Too Large               |
| `uriTooLong(message?, context?)`                  | `414` | URI Too Long                    |
| `unsupportedMediaType(message?, context?)`        | `415` | Unsupported Media Type          |
| `rangeNotSatisfiable(message?, context?)`         | `416` | Range Not Satisfiable           |
| `expectationFailed(message?, context?)`           | `417` | Expectation Failed              |
| `imATeapot(message?, context?)`                   | `418` | I'm a Teapot                    |
| `misdirectedRequest(message?, context?)`          | `421` | Misdirected Request             |
| `unprocessableEntity(message?, context?)`         | `422` | Unprocessable Entity            |
| `validationError(message, context?)`              | `422` | _(required)_                    |
| `locked(message?, context?)`                      | `423` | Locked                          |
| `failedDependency(message?, context?)`            | `424` | Failed Dependency               |
| `tooEarly(message?, context?)`                    | `425` | Too Early                       |
| `upgradeRequired(message?, context?)`             | `426` | Upgrade Required                |
| `preconditionRequired(message?, context?)`        | `428` | Precondition Required           |
| `tooManyRequests(message?, context?)`             | `429` | Too Many Requests               |
| `requestHeaderFieldsTooLarge(message?, context?)` | `431` | Request Header Fields Too Large |
| `unavailableForLegalReasons(message?, context?)`  | `451` | Unavailable For Legal Reasons   |

</details>

<details>
<summary>🔴 <strong>5xx Server Errors</strong> <em>(click to expand)</em></summary>

| Method                                              | Code  | Default Message                 |
| :-------------------------------------------------- | :---: | :------------------------------ |
| `internalServerError(message?, context?)`           | `500` | Internal Server Error           |
| `notImplemented(message?, context?)`                | `501` | Not Implemented                 |
| `badGateway(message?, context?)`                    | `502` | Bad Gateway                     |
| `serviceUnavailable(message?, context?)`            | `503` | Service Unavailable             |
| `gatewayTimeout(message?, context?)`                | `504` | Gateway Timeout                 |
| `httpVersionNotSupported(message?, context?)`       | `505` | HTTP Version Not Supported      |
| `variantAlsoNegotiates(message?, context?)`         | `506` | Variant Also Negotiates         |
| `insufficientStorage(message?, context?)`           | `507` | Insufficient Storage            |
| `loopDetected(message?, context?)`                  | `508` | Loop Detected                   |
| `bandwidthLimitExceeded(message?, context?)`        | `509` | Bandwidth Limit Exceeded        |
| `notExtended(message?, context?)`                   | `510` | Not Extended                    |
| `networkAuthenticationRequired(message?, context?)` | `511` | Network Authentication Required |
| `networkConnectTimeout(message?, context?)`         | `599` | Network Connect Timeout         |

</details>

---

## 🟦 TypeScript Support

Error Shield ships with **full TypeScript declarations** — zero extra config needed.

```typescript
import {
  AppError,
  ErrorCreators,
  handleError,
  asyncHandler,
  expressErrorHandler,
  type ErrorDetails,
  type ErrorHandlerOptions,
} from "error-shield";

// Fully typed error creation
const error: AppError = ErrorCreators.notFound("User not found", {
  userId: 42,
});

// Typed error details
const details: ErrorDetails = handleError(error, {
  includeStack: true,
  includeTimestamp: true,
});
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. **Fork** the repository
2. **Create** your feature branch — `git checkout -b feature/amazing-feature`
3. **Commit** your changes — `git commit -m "feat: add amazing feature"`
4. **Push** to the branch — `git push origin feature/amazing-feature`
5. **Open** a Pull Request

---

## 📄 License 

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).

---

<div align="center">

Made with ❤️ by **[Gopinath Kathirvel](https://github.com/Gopinathgopi13)**

⭐ **If you found this useful, give it a star on [GitHub](https://github.com/Gopinathgopi13/error-shield)!** ⭐

</div>
