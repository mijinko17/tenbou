import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type { AdvancePaymentRepository } from "../domain/repositories/advance-payment";
import type { AppError } from "../errors";
import { createAdvancePayment, deleteAdvancePayment } from "./advance-payments";

const playerIds = ["p1", "p2", "p3", "p4"];

function makeRepo(
	overrides?: Partial<AdvancePaymentRepository>,
): AdvancePaymentRepository {
	return {
		findGroup: () => okAsync({ id: "g1" }),
		findPlayerIds: () => okAsync(playerIds),
		createPayment: () => okAsync<void, AppError>(undefined),
		findPayment: () => okAsync({ id: "pay1" }),
		deletePayment: () => okAsync<void, AppError>(undefined),
		...overrides,
	};
}

const validInput = {
	payerId: "p1",
	beneficiaryIds: ["p2", "p3"],
	description: "飲み代",
	amount: 3000,
};

describe("createAdvancePayment", () => {
	it("グループが存在しない場合は404を返す", async () => {
		const repo = makeRepo({ findGroup: () => okAsync(null) });
		const result = await createAdvancePayment(repo, "g1", validInput);
		expect(result._unsafeUnwrapErr()).toMatchObject({ status: 404 });
	});

	it("payerIdがグループに属さない場合は422を返す", async () => {
		const repo = makeRepo();
		const result = await createAdvancePayment(repo, "g1", {
			...validInput,
			payerId: "unknown",
		});
		expect(result._unsafeUnwrapErr().message).toMatch(/payerId/);
	});

	it("beneficiaryIdがグループに属さない場合は422を返す", async () => {
		const repo = makeRepo();
		const result = await createAdvancePayment(repo, "g1", {
			...validInput,
			beneficiaryIds: ["p2", "unknown"],
		});
		expect(result._unsafeUnwrapErr().message).toMatch(/beneficiaryId/);
	});

	it("立替対象が立替者のみの場合は422を返す", async () => {
		const repo = makeRepo();
		const result = await createAdvancePayment(repo, "g1", {
			...validInput,
			beneficiaryIds: ["p1"],
		});
		expect(result._unsafeUnwrapErr().message).toMatch(/立替対象が立替者のみ/);
	});

	it("beneficiaryIdsに立替者が含まれていても他のメンバーがいれば登録できる", async () => {
		const repo = makeRepo();
		const result = await createAdvancePayment(repo, "g1", {
			...validInput,
			beneficiaryIds: ["p1", "p2"], // p1 が payer だが p2 もいる
		});
		expect(result.isOk()).toBe(true);
	});

	it("正常な入力でcreatePaymentを呼び出す", async () => {
		const calls: Parameters<AdvancePaymentRepository["createPayment"]>[0][] =
			[];
		const repo = makeRepo({
			createPayment: (data) => {
				calls.push(data);
				return okAsync<void, AppError>(undefined);
			},
		});
		const result = await createAdvancePayment(repo, "g1", validInput);
		expect(result.isOk()).toBe(true);
		expect(calls).toHaveLength(1);
		const saved = calls[0];
		expect(saved).toMatchObject({
			groupId: "g1",
			payerId: validInput.payerId,
			beneficiaryIds: validInput.beneficiaryIds,
			description: validInput.description,
			amount: validInput.amount,
		});
		expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
	});
});

describe("deleteAdvancePayment", () => {
	it("支払いが存在しない場合は404を返す", async () => {
		const repo = makeRepo({ findPayment: () => okAsync(null) });
		const result = await deleteAdvancePayment(repo, "g1", "pay1");
		expect(result._unsafeUnwrapErr()).toMatchObject({ status: 404 });
	});

	it("正常にdeletePaymentを呼び出す", async () => {
		let deleted = false;
		const repo = makeRepo({
			deletePayment: () => {
				deleted = true;
				return okAsync<void, AppError>(undefined);
			},
		});
		const result = await deleteAdvancePayment(repo, "g1", "pay1");
		expect(result.isOk()).toBe(true);
		expect(deleted).toBe(true);
	});
});
