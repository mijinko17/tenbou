import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { createRoundRepository } from "../repositories/rounds";
import { createRound, deleteRound } from "../services/rounds";
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
		return c.json(result, 201);
	},
);

rounds.delete("/:groupId/rounds/:roundId", async (c) => {
	const { groupId, roundId } = c.req.param();
	const db = drizzle(c.env.DB);
	const repo = createRoundRepository(db);
	await deleteRound(repo, groupId, roundId);
	return new Response(null, { status: 204 });
});

export default rounds;
