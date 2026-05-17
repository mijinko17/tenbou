import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import { createGroupRepository } from "../repositories/groups";
import { createGroup, deletePlayer, getGroup } from "../services/groups";
import type { Env } from "../types";

const groups = new Hono<{ Bindings: Env }>();

const createGroupSchema = z.object({
	name: z.string().min(1).max(30),
	players: z.array(z.string().min(1).max(10)).min(4).max(5),
	rate: z.number().int().positive(),
	chipRate: z.number().int().positive(),
	uma: z
		.tuple([
			z.number().int(),
			z.number().int(),
			z.number().int(),
			z.number().int(),
		])
		.refine(
			(arr) => arr.reduce((a, b) => a + b, 0) === 0,
			"ウマの合計は0である必要があります",
		),
	tobi: z.number().int().nonnegative().default(10),
	genten: z.number().int().positive(),
	kaeshi: z.number().int().positive(),
});

groups.post("/", zValidator("json", createGroupSchema), async (c) => {
	const db = drizzle(c.env.DB);
	const repo = createGroupRepository(db);
	const { groupId } = await createGroup(repo, c.req.valid("json"));
	return c.json({ groupId }, 201);
});

groups.get("/:groupId", async (c) => {
	const db = drizzle(c.env.DB);
	const repo = createGroupRepository(db);
	const data = await getGroup(repo, c.req.param("groupId"));
	return c.json(data);
});

groups.delete("/:groupId/players/:playerId", async (c) => {
	const { groupId, playerId } = c.req.param();
	const db = drizzle(c.env.DB);
	const repo = createGroupRepository(db);
	await deletePlayer(repo, groupId, playerId);
	return c.json({ success: true });
});

export default groups;
