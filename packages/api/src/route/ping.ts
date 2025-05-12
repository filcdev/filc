import type { TRPCRouterRecord } from '@trpc/server'
import { protectedProcedure, publicProcedure } from '../trpc/index.ts'

export const pingRouter = {
  public: publicProcedure.query(() => {
    return {
      message: 'pong',
    }
  }),

  private: protectedProcedure.query(({ ctx }) => {
    return {
      message: 'pong',
      user: ctx.session?.user,
    }
  }),
} satisfies TRPCRouterRecord
