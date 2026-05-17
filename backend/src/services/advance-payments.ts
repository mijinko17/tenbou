import { ResultAsync, err, ok } from "neverthrow";
import { AppError } from "../errors";

export type AdvancePaymentRepo = {
	findGroup(groupId: string): Promise<{ id: string } | null>;
	findPlayerIds(groupId: string): Promise<string[]>;
	createPayment(data: {
		id: string;
		groupId: string;
		payerId: string;
		beneficiaryIds: string[];
		description: string;
		amount: number;
		createdAt: number;
	}): Promise<void>;
	findPayment(
		groupId: string,
		paymentId: string,
	): Promise<{ id: string } | null>;
	deletePayment(paymentId: string): Promise<void>;
};

export type CreateAdvancePaymentInput = {
	payerId: string;
	beneficiaryIds: string[];
	description: string;
	amount: number;
};

export function createAdvancePayment(
	repo: AdvancePaymentRepo,
	groupId: string,
	input: CreateAdvancePaymentInput,
): ResultAsync<void, AppError> {
	return ResultAsync.fromSafePromise(repo.findGroup(groupId))
		.andThen((group) =>
			group ? ok(undefined) : err(new AppError("Group not found", 404)),
		)
		.andThen(() => ResultAsync.fromSafePromise(repo.findPlayerIds(groupId)))
		.andThen((ids) => {
			const groupPlayerIds = new Set(ids);
			if (!groupPlayerIds.has(input.payerId)) {
				return err(new AppError("Invalid payerId"));
			}
			for (const bid of input.beneficiaryIds) {
				if (!groupPlayerIds.has(bid)) {
					return err(new AppError("Invalid beneficiaryId"));
				}
			}
			if (input.beneficiaryIds.every((bid) => bid === input.payerId)) {
				return err(
					new AppError("立替対象が立替者のみのケースは登録できません"),
				);
			}
			return ok(undefined);
		})
		.andThen(() =>
			ResultAsync.fromSafePromise(
				repo.createPayment({
					id: crypto.randomUUID(),
					groupId,
					payerId: input.payerId,
					beneficiaryIds: input.beneficiaryIds,
					description: input.description,
					amount: input.amount,
					createdAt: Math.floor(Date.now() / 1000),
				}),
			),
		);
}

export function deleteAdvancePayment(
	repo: AdvancePaymentRepo,
	groupId: string,
	paymentId: string,
): ResultAsync<void, AppError> {
	return ResultAsync.fromSafePromise(repo.findPayment(groupId, paymentId))
		.andThen((payment) =>
			payment ? ok(undefined) : err(new AppError("Payment not found", 404)),
		)
		.andThen(() => ResultAsync.fromSafePromise(repo.deletePayment(paymentId)));
}
