import { protectedProcedure, publicProcedure } from '@/trpc'
import type { TRPCRouterRecord } from '@trpc/server'

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
