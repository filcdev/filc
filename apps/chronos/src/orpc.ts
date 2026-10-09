import { appContract } from '@filcdev/api/contract';
import { implement } from '@orpc/server';
import type { ChronosContext } from '#_types/globals';

/**
 * The implementer every Chronos procedure is built from. Because it is bound
 * to the contract, `.handler()`'s input and output types come from
 * `@filcdev/api/contract` and `base.router({...})` fails to compile when a
 * procedure is missing, extra, or mistyped.
 */
export const base = implement(appContract).$context<ChronosContext>();
