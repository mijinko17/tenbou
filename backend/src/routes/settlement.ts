import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { createSettlementRepository } from "../repositories/settlement";
import { getSettlement } from "../services/settlement";
import type { Env } from "../types";

const settlement = new Hono<{ Bindings: Env }>();

settlement.get("/:groupId/settlement", async (c) => {
	const db = drizzle(c.env.DB);
	const repo = createSettlementRepository(db);
	const data = await getSettlement(repo, c.req.param("groupId"));
	return c.json(data);
});

export default settlement;
