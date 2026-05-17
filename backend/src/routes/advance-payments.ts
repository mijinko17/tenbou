import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { z } from "zod";
import * as schema from "../db/schema";
import type { Env } from "../types";

const advancePayments = new Hono<{ Bindings: Env }>();

const createAdvancePaymentSchema = z.object({
	payerId: z.string().uuid(),
	beneficiaryIds: z.array(z.string().uuid()).min(1),
	description: z.string().min(1).max(100),
	amount: z.number().int().positive(),
});

advancePayments.post(
	"/:groupId/advance-payments",
	zValidator("json", createAdvancePaymentSchema),
	async (c) => {
		const { groupId } = c.req.param();
		const body = c.req.valid("json");
		const db = drizzle(c.env.DB);

		const [group] = await db
			.select({ id: schema.groups.id })
			.from(schema.groups)
			.where(eq(schema.groups.id, groupId))
			.limit(1);
		if (!group) return c.json({ error: "Group not found" }, 404);

		const groupPlayers = await db
			.select({ id: schema.players.id })
			.from(schema.players)
			.where(eq(schema.players.group_id, groupId));
		const groupPlayerIds = new Set(groupPlayers.map((p) => p.id));

		if (!groupPlayerIds.has(body.payerId)) {
			return c.json({ error: "Invalid payerId" }, 422);
		}
		for (const bid of body.beneficiaryIds) {
			if (!groupPlayerIds.has(bid)) {
				return c.json({ error: "Invalid beneficiaryId" }, 422);
			}
		}
		if (body.beneficiaryIds.every((bid) => bid === body.payerId)) {
			return c.json(
				{ error: "立替対象が立替者のみのケースは登録できません" },
				422,
			);
		}

		await db.insert(schema.advance_payments).values({
			id: crypto.randomUUID(),
			group_id: groupId,
			payer_id: body.payerId,
			beneficiary_ids: JSON.stringify(body.beneficiaryIds),
			description: body.description,
			amount: body.amount,
			created_at: Math.floor(Date.now() / 1000),
		});

		return c.json({ success: true }, 201);
	},
);

advancePayments.delete(
	"/:groupId/advance-payments/:paymentId",
	async (c) => {
		const { groupId, paymentId } = c.req.param();
		const db = drizzle(c.env.DB);

		const [payment] = await db
			.select({ id: schema.advance_payments.id })
			.from(schema.advance_payments)
			.where(
				and(
					eq(schema.advance_payments.id, paymentId),
					eq(schema.advance_payments.group_id, groupId),
				),
			)
			.limit(1);

		if (!payment) return c.json({ error: "Payment not found" }, 404);

		await db
			.delete(schema.advance_payments)
			.where(eq(schema.advance_payments.id, paymentId));

		return c.json({ success: true });
	},
);

export default advancePayments;
