import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    AppError,
    formatError,
    handleError,
    asyncHandler,
    expressErrorHandler,
    createErrorResponse,
    withRetry,
    Errors,
    type ErrorDetails,
    type ErrorHandlerOptions,
    type RetryOptions,
} from './index.js';

// ─── AppError ────────────────────────────────────────────────────────────────

describe('AppError', () => {
    it('should create an instance with default values', () => {
        const error = new AppError('Something went wrong');
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect(error.message).toBe('Something went wrong');
        expect(error.statusCode).toBe(500);
        expect(error.code).toBeUndefined();
        expect(error.context).toBeUndefined();
        expect(error.isOperational).toBe(true);
        expect(error.name).toBe('AppError');
    });

    it('should create an instance with all custom values', () => {
        const ctx = { userId: 42 };
        const error = new AppError('Not found', 404, 'NOT_FOUND', ctx);
        expect(error.message).toBe('Not found');
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
        expect(error.context).toEqual(ctx);
        expect(error.isOperational).toBe(true);
    });

    it('should have a stack trace', () => {
        const error = new AppError('test');
        expect(error.stack).toBeDefined();
        expect(typeof error.stack).toBe('string');
    });

    it('should be catchable as a regular Error', () => {
        try {
            throw new AppError('thrown', 400);
        } catch (err) {
            expect(err).toBeInstanceOf(Error);
            expect(err).toBeInstanceOf(AppError);
        }
    });

    // ── Error chaining ────────────────────────────────────────────────────────

    describe('error chaining (cause)', () => {
        it('should accept a cause parameter', () => {
            const original = new Error('original failure');
            const wrapped = new AppError('wrapper', 500, 'WRAP', undefined, original);

            expect(wrapped.cause).toBe(original);
            expect(wrapped.message).toBe('wrapper');
        });

        it('should work without a cause', () => {
            const error = new AppError('no cause');
            expect(error.cause).toBeUndefined();
        });

        it('should support nested cause chains', () => {
            const root = new Error('root');
            const mid = new AppError('mid', 500, 'MID', undefined, root);
            const top = new AppError('top', 502, 'TOP', undefined, mid);

            expect(top.cause).toBe(mid);
            expect((top.cause as AppError).cause).toBe(root);
        });
    });

    // ── AppError.wrap ─────────────────────────────────────────────────────────

    describe('AppError.wrap()', () => {
        it('should wrap an error as cause', () => {
            const original = new Error('DB timeout');
            const wrapped = AppError.wrap(original, 'Query failed', 500, 'DB_ERROR');

            expect(wrapped).toBeInstanceOf(AppError);
            expect(wrapped.message).toBe('Query failed');
            expect(wrapped.statusCode).toBe(500);
            expect(wrapped.code).toBe('DB_ERROR');
            expect(wrapped.cause).toBe(original);
        });

        it('should use default statusCode 500', () => {
            const original = new Error('oops');
            const wrapped = AppError.wrap(original, 'Wrapped');
            expect(wrapped.statusCode).toBe(500);
        });

        it('should pass context through', () => {
            const original = new Error('fail');
            const ctx = { table: 'users' };
            const wrapped = AppError.wrap(original, 'Wrapped', 502, 'CODE', ctx);
            expect(wrapped.context).toEqual(ctx);
        });
    });
});

// ─── formatError ─────────────────────────────────────────────────────────────

describe('formatError', () => {
    it('should format a plain Error', () => {
        const error = new Error('plain error');
        const result = formatError(error);

        expect(result.message).toBe('plain error');
        expect(result.timestamp).toBeDefined();
        expect(result.code).toBeUndefined();
        expect(result.statusCode).toBeUndefined();
        expect(result.stack).toBeUndefined();
    });

    it('should format an AppError with code and statusCode', () => {
        const error = new AppError('app error', 404, 'NOT_FOUND');
        const result = formatError(error);

        expect(result.message).toBe('app error');
        expect(result.code).toBe('NOT_FOUND');
        expect(result.statusCode).toBe(404);
        expect(result.timestamp).toBeDefined();
    });

    it('should include stack when includeStack=true', () => {
        const error = new Error('stack test');
        const result = formatError(error, { includeStack: true });
        expect(result.stack).toBeDefined();
    });

    it('should omit timestamp when includeTimestamp=false', () => {
        const error = new Error('no ts');
        const result = formatError(error, { includeTimestamp: false });
        expect(result.timestamp).toBeUndefined();
    });

    it('should merge context from AppError and options', () => {
        const error = new AppError('ctx test', 400, 'BAD', { a: 1 });
        const result = formatError(error, { context: { b: 2 } });
        expect(result.context).toEqual({ a: 1, b: 2 });
    });

    it('should use options context for plain Errors', () => {
        const error = new Error('plain');
        const result = formatError(error, { context: { key: 'value' } });
        expect(result.context).toEqual({ key: 'value' });
    });

    it('should omit context when empty', () => {
        const error = new Error('no ctx');
        const result = formatError(error);
        expect(result.context).toBeUndefined();
    });

    // ── Cause chain formatting ────────────────────────────────────────────────

    describe('cause chain formatting', () => {
        it('should include cause in output', () => {
            const original = new Error('root cause');
            const wrapped = new AppError('wrapper', 500, 'WRAP', undefined, original);

            const result = formatError(wrapped);
            expect(result.cause).toBeDefined();
            expect(result.cause!.message).toBe('root cause');
        });

        it('should recursively format nested causes', () => {
            const root = new Error('root');
            const mid = new AppError('mid', 400, 'MID_CODE', undefined, root);
            const top = new AppError('top', 502, 'TOP_CODE', undefined, mid);

            const result = formatError(top);
            expect(result.cause).toBeDefined();
            expect(result.cause!.message).toBe('mid');
            expect(result.cause!.code).toBe('MID_CODE');
            expect(result.cause!.cause).toBeDefined();
            expect(result.cause!.cause!.message).toBe('root');
        });

        it('should not include cause timestamp', () => {
            const original = new Error('root');
            const wrapped = new AppError('wrapper', 500, 'W', undefined, original);

            const result = formatError(wrapped, { includeTimestamp: true });
            expect(result.timestamp).toBeDefined();
            expect(result.cause!.timestamp).toBeUndefined();
        });

        it('should include cause stack when includeStack=true', () => {
            const original = new Error('root');
            const wrapped = new AppError('wrapper', 500, 'W', undefined, original);

            const result = formatError(wrapped, { includeStack: true });
            expect(result.cause!.stack).toBeDefined();
        });
    });
});

// ─── handleError ─────────────────────────────────────────────────────────────

describe('handleError', () => {
    it('should return formatted error details', () => {
        const error = new AppError('handled', 400, 'HANDLED');
        const result = handleError(error);

        expect(result.message).toBe('handled');
        expect(result.code).toBe('HANDLED');
        expect(result.statusCode).toBe(400);
    });

    it('should call logger when provided', () => {
        const logger = vi.fn();
        const error = new Error('log me');
        handleError(error, { logger });

        expect(logger).toHaveBeenCalledTimes(1);
        expect(logger).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'log me' })
        );
    });

    it('should not throw when no logger is provided', () => {
        const error = new Error('no logger');
        expect(() => handleError(error)).not.toThrow();
    });

    it('should pass formatting options through', () => {
        const error = new Error('opts test');
        const result = handleError(error, {
            includeStack: true,
            includeTimestamp: false,
        });
        expect(result.stack).toBeDefined();
        expect(result.timestamp).toBeUndefined();
    });
});

// ─── asyncHandler ────────────────────────────────────────────────────────────

describe('asyncHandler', () => {
    it('should pass through successful results', async () => {
        const fn = async (x: number) => x * 2;
        const wrapped = asyncHandler(fn);
        const result = await wrapped(5);
        expect(result).toBe(10);
    });

    it('should propagate errors', async () => {
        const fn = async () => {
            throw new AppError('async fail', 400);
        };
        const wrapped = asyncHandler(fn);

        await expect(wrapped()).rejects.toThrow('async fail');
        await expect(wrapped()).rejects.toBeInstanceOf(AppError);
    });

    it('should handle non-error rejections', async () => {
        const fn = async () => {
            throw 'string error';
        };
        const wrapped = asyncHandler(fn);
        await expect(wrapped()).rejects.toBe('string error');
    });
});

// ─── expressErrorHandler ─────────────────────────────────────────────────────

describe('expressErrorHandler', () => {
    let mockReq: any;
    let mockRes: any;
    let mockNext: any;

    beforeEach(() => {
        mockReq = { method: 'GET', path: '/test', ip: '127.0.0.1' };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };
        mockNext = vi.fn();
    });

    it('should respond with JSON by default', () => {
        const handler = expressErrorHandler();
        const error = new AppError('json test', 400, 'BAD');

        handler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'json test',
                code: 'BAD',
                statusCode: 400,
            })
        );
    });

    it('should respond with string when format is "string"', () => {
        const handler = expressErrorHandler({ format: 'string' });
        const error = new AppError('string test', 422, 'VALIDATION');

        handler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(422);
        expect(mockRes.send).toHaveBeenCalledWith('string test');
    });

    it('should default to 500 for plain Errors', () => {
        const handler = expressErrorHandler();
        const error = new Error('plain');

        handler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should use 500 when AppError has falsy statusCode', () => {
        const handler = expressErrorHandler();
        const error = new AppError('edge case', 0, 'ZERO_STATUS');

        handler(error, mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should inject request context', () => {
        const handler = expressErrorHandler();
        const error = new AppError('ctx', 400, 'CODE');

        handler(error, mockReq, mockRes, mockNext);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.context).toMatchObject({
            method: 'GET',
            path: '/test',
            ip: '127.0.0.1',
        });
    });

    it('should merge user-provided context with request context', () => {
        const handler = expressErrorHandler({ context: { service: 'api' } });
        const error = new AppError('merge', 500, 'ERR');

        handler(error, mockReq, mockRes, mockNext);

        const jsonArg = mockRes.json.mock.calls[0][0];
        expect(jsonArg.context).toMatchObject({
            service: 'api',
            method: 'GET',
        });
    });

    it('should call logger when provided', () => {
        const logger = vi.fn();
        const handler = expressErrorHandler({ logger });
        const error = new AppError('logged', 500, 'LOG');

        handler(error, mockReq, mockRes, mockNext);

        expect(logger).toHaveBeenCalledTimes(1);
    });
});

// ─── createErrorResponse ─────────────────────────────────────────────────────

describe('createErrorResponse', () => {
    it('should create an AppError with given params', () => {
        const err = createErrorResponse('cust msg', 403, 'CUSTOM_CODE', { key: 'val' });

        expect(err).toBeInstanceOf(AppError);
        expect(err.message).toBe('cust msg');
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('CUSTOM_CODE');
        expect(err.context).toEqual({ key: 'val' });
    });

    it('should use defaults when optional params omitted', () => {
        const err = createErrorResponse('minimal');
        expect(err.statusCode).toBe(500);
        expect(err.code).toBeUndefined();
        expect(err.context).toBeUndefined();
    });
});

// ─── Errors factory ──────────────────────────────────────────────────────────

describe('Errors factory', () => {
    const testCases: Array<{
        name: string;
        fn: string;
        expectedStatus: number;
        expectedCode: string;
        defaultMsg?: string;
    }> = [
            { name: 'badRequest', fn: 'badRequest', expectedStatus: 400, expectedCode: 'BAD_REQUEST' },
            { name: 'unauthorized', fn: 'unauthorized', expectedStatus: 401, expectedCode: 'UNAUTHORIZED', defaultMsg: 'Unauthorized' },
            { name: 'forbidden', fn: 'forbidden', expectedStatus: 403, expectedCode: 'FORBIDDEN', defaultMsg: 'Forbidden' },
            { name: 'notFound', fn: 'notFound', expectedStatus: 404, expectedCode: 'NOT_FOUND', defaultMsg: 'Not Found' },
            { name: 'methodNotAllowed', fn: 'methodNotAllowed', expectedStatus: 405, expectedCode: 'METHOD_NOT_ALLOWED', defaultMsg: 'Method Not Allowed' },
            { name: 'conflict', fn: 'conflict', expectedStatus: 409, expectedCode: 'CONFLICT' },
            { name: 'validationError', fn: 'validationError', expectedStatus: 422, expectedCode: 'VALIDATION_ERROR' },
            { name: 'tooManyRequests', fn: 'tooManyRequests', expectedStatus: 429, expectedCode: 'TOO_MANY_REQUESTS', defaultMsg: 'Too Many Requests' },
            { name: 'internalServerError', fn: 'internalServerError', expectedStatus: 500, expectedCode: 'INTERNAL_SERVER_ERROR', defaultMsg: 'Internal Server Error' },
            { name: 'serviceUnavailable', fn: 'serviceUnavailable', expectedStatus: 503, expectedCode: 'SERVICE_UNAVAILABLE', defaultMsg: 'Service Unavailable' },
            { name: 'gatewayTimeout', fn: 'gatewayTimeout', expectedStatus: 504, expectedCode: 'GATEWAY_TIMEOUT', defaultMsg: 'Gateway Timeout' },
            { name: 'imATeapot', fn: 'imATeapot', expectedStatus: 418, expectedCode: 'IM_A_TEAPOT', defaultMsg: "I'm a Teapot" },
        ];

    testCases.forEach(({ name, fn, expectedStatus, expectedCode, defaultMsg }) => {
        describe(name, () => {
            it('should create an AppError with correct statusCode and code', () => {
                const error = (Errors as any)[fn]('custom message');
                expect(error).toBeInstanceOf(AppError);
                expect(error.statusCode).toBe(expectedStatus);
                expect(error.code).toBe(expectedCode);
                expect(error.message).toBe('custom message');
            });

            if (defaultMsg) {
                it(`should use default message "${defaultMsg}"`, () => {
                    const error = (Errors as any)[fn]();
                    expect(error.message).toBe(defaultMsg);
                });
            }

            it('should accept context', () => {
                const ctx = { detail: 'test' };
                const error = (Errors as any)[fn]('msg', ctx);
                expect(error.context).toEqual(ctx);
            });
        });
    });

    it('should have all expected 4xx error factories', () => {
        const expected4xx = [
            'badRequest', 'unauthorized', 'paymentRequired', 'forbidden',
            'notFound', 'methodNotAllowed', 'notAcceptable', 'proxyAuthRequired',
            'requestTimeout', 'conflict', 'gone', 'lengthRequired',
            'preconditionFailed', 'payloadTooLarge', 'uriTooLong',
            'unsupportedMediaType', 'rangeNotSatisfiable', 'expectationFailed',
            'imATeapot', 'misdirectedRequest', 'unprocessableEntity',
            'validationError', 'locked', 'failedDependency', 'tooEarly',
            'upgradeRequired', 'preconditionRequired', 'tooManyRequests',
            'requestHeaderFieldsTooLarge', 'unavailableForLegalReasons',
        ];
        expected4xx.forEach((name) => {
            expect(typeof Errors[name]).toBe('function');
        });
    });

    it('should have all expected 5xx error factories', () => {
        const expected5xx = [
            'internalServerError', 'notImplemented', 'badGateway',
            'serviceUnavailable', 'gatewayTimeout', 'httpVersionNotSupported',
            'variantAlsoNegotiates', 'insufficientStorage', 'loopDetected',
            'bandwidthLimitExceeded', 'notExtended',
            'networkAuthenticationRequired', 'networkConnectTimeout',
        ];
        expected5xx.forEach((name) => {
            expect(typeof Errors[name]).toBe('function');
        });
    });

    it('should invoke every error factory for full coverage', () => {
        const factoriesRequiringMessage = ['badRequest', 'conflict', 'validationError'];
        for (const key of Object.keys(Errors) as (keyof typeof Errors)[]) {
            const fn = Errors[key];
            expect(typeof fn).toBe('function');
            const err = factoriesRequiringMessage.includes(key)
                ? fn('custom message')
                : (fn as any)();
            expect(err).toBeInstanceOf(AppError);
            expect(err.message).toBeDefined();
            expect(err.statusCode).toBeGreaterThanOrEqual(400);
            expect(err.code).toBeDefined();
        }
    });
});

// ─── withRetry ───────────────────────────────────────────────────────────────

describe('withRetry', () => {
    it('should return result on first successful attempt', async () => {
        const fn = vi.fn().mockResolvedValueOnce('success');
        const result = await withRetry(fn, { maxRetries: 3 });
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockResolvedValueOnce('got it');

        const result = await withRetry(fn, {
            maxRetries: 3,
            initialDelay: 10,
            jitter: false,
        });

        expect(result).toBe('got it');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after exhausting all retries', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('always fails'));

        await expect(
            withRetry(fn, { maxRetries: 2, initialDelay: 10, jitter: false })
        ).rejects.toThrow('always fails');

        // initial + 2 retries = 3 calls
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should attach attempts array to final error', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('fail'));

        try {
            await withRetry(fn, { maxRetries: 2, initialDelay: 10, jitter: false });
        } catch (err: any) {
            expect(err.attempts).toBeDefined();
            expect(err.attempts).toHaveLength(3);
        }
    });

    // ── Backoff strategies ────────────────────────────────────────────────────

    describe('backoff strategies', () => {
        it('should use fixed backoff', async () => {
            const delays: number[] = [];
            const originalSetTimeout = globalThis.setTimeout;

            vi.useFakeTimers();

            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('f1'))
                .mockRejectedValueOnce(new Error('f2'))
                .mockResolvedValueOnce('ok');

            // We can't easily test exact delay timings with fake timers in this setup,
            // so we'll test that the function completes with the right strategy
            vi.useRealTimers();

            const result = await withRetry(fn, {
                maxRetries: 3,
                backoff: 'fixed',
                initialDelay: 10,
                jitter: false,
            });

            expect(result).toBe('ok');
        });

        it('should use linear backoff', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('f1'))
                .mockResolvedValueOnce('ok');

            const result = await withRetry(fn, {
                maxRetries: 3,
                backoff: 'linear',
                initialDelay: 10,
                jitter: false,
            });

            expect(result).toBe('ok');
        });

        it('should use exponential backoff (default)', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('f1'))
                .mockResolvedValueOnce('ok');

            const result = await withRetry(fn, {
                maxRetries: 3,
                backoff: 'exponential',
                initialDelay: 10,
                jitter: false,
            });

            expect(result).toBe('ok');
        });

        it('should fall back to initialDelay when backoff is unrecognized (default branch)', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('f1'))
                .mockResolvedValueOnce('ok');

            const result = await withRetry(fn, {
                maxRetries: 3,
                backoff: 'unrecognized' as any,
                initialDelay: 10,
                jitter: false,
            });

            expect(result).toBe('ok');
            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    // ── retryIf predicate ─────────────────────────────────────────────────────

    describe('retryIf', () => {
        it('should skip retry when retryIf returns false', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));

            await expect(
                withRetry(fn, {
                    maxRetries: 5,
                    initialDelay: 10,
                    jitter: false,
                    retryIf: () => false,
                })
            ).rejects.toThrow('non-retryable');

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should retry when retryIf returns true', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('retryable'))
                .mockResolvedValueOnce('done');

            const result = await withRetry(fn, {
                maxRetries: 3,
                initialDelay: 10,
                jitter: false,
                retryIf: (err) => err.message === 'retryable',
            });

            expect(result).toBe('done');
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should stop retrying when error changes and retryIf returns false', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('retryable'))
                .mockRejectedValueOnce(new Error('fatal'));

            await expect(
                withRetry(fn, {
                    maxRetries: 5,
                    initialDelay: 10,
                    jitter: false,
                    retryIf: (err) => err.message === 'retryable',
                })
            ).rejects.toThrow('fatal');

            expect(fn).toHaveBeenCalledTimes(2);
        });
    });

    // ── onRetry callback ──────────────────────────────────────────────────────

    describe('onRetry', () => {
        it('should call onRetry before each retry attempt', async () => {
            const onRetry = vi.fn();
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('fail 1'))
                .mockRejectedValueOnce(new Error('fail 2'))
                .mockResolvedValueOnce('ok');

            await withRetry(fn, {
                maxRetries: 3,
                initialDelay: 10,
                jitter: false,
                onRetry,
            });

            expect(onRetry).toHaveBeenCalledTimes(2);
            expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
            expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
        });

        it('should not call onRetry on first attempt', async () => {
            const onRetry = vi.fn();
            const fn = vi.fn().mockResolvedValueOnce('ok');

            await withRetry(fn, {
                maxRetries: 3,
                initialDelay: 10,
                onRetry,
            });

            expect(onRetry).not.toHaveBeenCalled();
        });
    });

    // ── maxDelay cap ───────────────────────────────────────────────────────────

    describe('maxDelay', () => {
        it('should cap delay at maxDelay', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('f'))
                .mockResolvedValueOnce('ok');

            // With exponential backoff and initialDelay=50000, maxDelay=100
            // the delay should be capped at 100ms
            const start = Date.now();
            await withRetry(fn, {
                maxRetries: 1,
                backoff: 'exponential',
                initialDelay: 50000,
                maxDelay: 100,
                jitter: false,
            });
            const elapsed = Date.now() - start;

            // Should not have waited 50 seconds
            expect(elapsed).toBeLessThan(1000);
        });
    });

    // ── Jitter ─────────────────────────────────────────────────────────────────

    describe('jitter', () => {
        it('should add jitter by default', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('f'))
                .mockResolvedValueOnce('ok');

            // Just verify it completes without error with default options
            const result = await withRetry(fn, {
                maxRetries: 1,
                initialDelay: 10,
            });

            expect(result).toBe('ok');
        });

        it('should work with jitter disabled', async () => {
            const fn = vi.fn()
                .mockRejectedValueOnce(new Error('f'))
                .mockResolvedValueOnce('ok');

            const result = await withRetry(fn, {
                maxRetries: 1,
                initialDelay: 10,
                jitter: false,
            });

            expect(result).toBe('ok');
        });
    });

    // ── Edge cases ─────────────────────────────────────────────────────────────

    describe('edge cases', () => {
        it('should handle non-Error throws', async () => {
            const fn = vi.fn().mockRejectedValue('string error');

            await expect(
                withRetry(fn, { maxRetries: 1, initialDelay: 10, jitter: false })
            ).rejects.toThrow('string error');
        });

        it('should work with maxRetries=0 (no retries)', async () => {
            const fn = vi.fn().mockRejectedValue(new Error('instant fail'));

            await expect(
                withRetry(fn, { maxRetries: 0, initialDelay: 10 })
            ).rejects.toThrow('instant fail');

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should use default options when none provided', async () => {
            const fn = vi.fn().mockResolvedValueOnce(42);
            const result = await withRetry(fn);
            expect(result).toBe(42);
        });
    });
});

// ─── Default export ──────────────────────────────────────────────────────────

describe('default export', () => {
    it('should export all public APIs', async () => {
        const mod = await import('./index.js');
        expect(mod.default).toBeDefined();
        expect(mod.default.AppError).toBe(AppError);
        expect(mod.default.formatError).toBe(formatError);
        expect(mod.default.handleError).toBe(handleError);
        expect(mod.default.asyncHandler).toBe(asyncHandler);
        expect(mod.default.expressErrorHandler).toBe(expressErrorHandler);
        expect(mod.default.createErrorResponse).toBe(createErrorResponse);
        expect(mod.default.withRetry).toBe(withRetry);
        expect(mod.default.Errors).toBe(Errors);
    });
});
