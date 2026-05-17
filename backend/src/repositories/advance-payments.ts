import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { AdvancePaymentRepo } from "../services/advance-payments";

type Db = ReturnType<typeof drizzle>;

export function createAdvancePaymentRepository(db: Db): AdvancePaymentRepo {
	return {
		async findGroup(groupId) {
			const [group] = await db
				.select({ id: schema.groups.id })
				.from(schema.groups)
				.where(eq(schema.groups.id, groupId))
				.limit(1);
			return group ?? null;
		},

		async findPlayerIds(groupId) {
			const players = await db
				.select({ id: schema.players.id })
				.from(schema.players)
				.where(eq(schema.players.group_id, groupId));
			return players.map((p) => p.id);
		},

		async createPayment({
			id,
			groupId,
			payerId,
			beneficiaryIds,
			description,
			amount,
			createdAt,
		}) {
			await db.insert(schema.advance_payments).values({
				id,
				group_id: groupId,
				payer_id: payerId,
				beneficiary_ids: JSON.stringify(beneficiaryIds),
				description,
				amount,
				created_at: createdAt,
			});
		},

		async findPayment(groupId, paymentId) {
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
			return payment ?? null;
		},

		async deletePayment(paymentId) {
			await db
				.delete(schema.advance_payments)
				.where(eq(schema.advance_payments.id, paymentId));
		},
	};
}
