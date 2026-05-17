import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { createRound, deleteRound } from "../application/rounds";
import { createRoundRepository } from "../infrastructure/repositories/round";
import type { Env } from "../types";

const rounds = new Hono<{ Bindings: Env }>();

const createRoundSchema = z.object({
	results: z
		.array(
			z.object({
				playerId: z.string().uuid(),
				rawPoints: z.number().int(),
			}),
		)
		.length(4),
	tobiKillerId: z.string().uuid().nullable().optional(),
	rankOrder: z.array(z.string().uuid()).length(4).optional(),
});

rounds.post(
	"/:groupId/rounds",
	zValidator("json", createRoundSchema),
	async (c) => {
		const db = drizzle(c.env.DB);
		const repo = createRoundRepository(db);
		const result = await createRound(
			repo,
			c.req.param("groupId"),
			c.req.valid("json"),
		);
		return result.match(
			(value) => c.json(value, 201),
			(err) => c.json({ error: err.message }, err.status),
		);
	},
);

rounds.delete("/:groupId/rounds/:roundId", async (c) => {
	const { groupId, roundId } = c.req.param();
	const db = drizzle(c.env.DB);
	const repo = createRoundRepository(db);
	const result = await deleteRound(repo, groupId, roundId);
	return result.match(
		() => new Response(null, { status: 204 }),
		(err) => c.json({ error: err.message }, err.status),
	);
});

export default rounds;
