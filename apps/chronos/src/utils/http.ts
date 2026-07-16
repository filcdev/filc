import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { StatusCodes } from 'http-status-codes';
import type { SuccessResponse } from '#_types/globals';

type Envelope<T> = SuccessResponse<T> & Record<string, unknown>;

/**
 * Respond with a success envelope. Keeps the `{ data, success: true }` shape
 * that the frontend `parseResponse` helper expects, without handlers having to
 * annotate `c.json<SuccessResponse<...>>` by hand. `extra` is spread into the
 * envelope (e.g. `{ total }` for paginated responses).
 */
export const ok = <T, C extends Context>(
  c: C,
  data: T,
  status: ContentfulStatusCode = StatusCodes.OK as ContentfulStatusCode,
  extra: Record<string, unknown> = {}
) => c.json<Envelope<T>>({ data, success: true, ...extra }, status);

export const created = <T, C extends Context>(c: C, data: T) =>
  ok(c, data, StatusCodes.CREATED as ContentfulStatusCode);

export const noContent = <C extends Context>(c: C) =>
  c.json({ success: true }, StatusCodes.NO_CONTENT as ContentfulStatusCode);

export const badRequest = (message: string, cause?: unknown) =>
  new HTTPException(StatusCodes.BAD_REQUEST, { cause, message });

export const notFound = (message = 'Not found', cause?: unknown) =>
  new HTTPException(StatusCodes.NOT_FOUND, { cause, message });

export const forbidden = (message = 'Forbidden', cause?: unknown) =>
  new HTTPException(StatusCodes.FORBIDDEN, { cause, message });

export const unauthorized = (message = 'Unauthorized', cause?: unknown) =>
  new HTTPException(StatusCodes.UNAUTHORIZED, { cause, message });
