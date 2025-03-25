import type { TRPCSwiftConfiguration } from 'trpc-swift'

import { appRouter } from './src'

export default {
  router: appRouter,
  outFile: './generated.swift'
} satisfies TRPCSwiftConfiguration
