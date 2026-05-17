import { and, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import { ResultAsync } from "neverthrow";
import * as schema from "../db/schema";
import { AppError } from "../errors";
import type { AdvancePaymentRepo } from "../services/advance-payments";

type Db = ReturnType<typeof drizzle>;

const dbErr = (e: unknown) => new AppError(String(e), 500);

export function createAdvancePaymentRepository(db: Db): AdvancePaymentRepo {
	return {
		findGroup(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.groups.id })
					.from(schema.groups)
					.where(eq(schema.groups.id, groupId))
					.limit(1)
					.then(([group]) => group ?? null),
				dbErr,
			);
		},

		findPlayerIds(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.players.id })
					.from(schema.players)
					.where(eq(schema.players.group_id, groupId))
					.then((players) => players.map((p) => p.id)),
				dbErr,
			);
		},

		createPayment({
			id,
			groupId,
			payerId,
			beneficiaryIds,
			description,
			amount,
			createdAt,
		}) {
			return ResultAsync.fromPromise(
				db
					.insert(schema.advance_payments)
					.values({
						id,
						group_id: groupId,
						payer_id: payerId,
						beneficiary_ids: JSON.stringify(beneficiaryIds),
						description,
						amount,
						created_at: createdAt,
					})
					.then(() => undefined),
				dbErr,
			);
		},

		findPayment(groupId, paymentId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.advance_payments.id })
					.from(schema.advance_payments)
					.where(
						and(
							eq(schema.advance_payments.id, paymentId),
							eq(schema.advance_payments.group_id, groupId),
						),
					)
					.limit(1)
					.then(([payment]) => payment ?? null),
				dbErr,
			);
		},

		deletePayment(paymentId) {
			return ResultAsync.fromPromise(
				db
					.delete(schema.advance_payments)
					.where(eq(schema.advance_payments.id, paymentId))
					.then(() => undefined),
				dbErr,
			);
		},
	};
}
