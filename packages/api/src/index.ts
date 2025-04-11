import { initTRPC } from "@trpc/server";
import { sleep } from "bun";

const t = initTRPC.create();

export const router = t.router({
	ping: t.procedure.query(() => {
		return "pong";
	}),

	subscribe: t.procedure.subscription(async function* () {
		await sleep(1000);
		yield Math.random();
	}),
});

export type AppRouter = typeof router;
