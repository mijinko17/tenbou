import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type { ChipRepository } from "../domain/repositories/chip";
import { AppError } from "../errors";
import { resetChips, updateChips } from "./chips";

const playerIds = ["p1", "p2", "p3", "p4"];

function makeRepo(overrides?: Partial<ChipRepository>): ChipRepository {
	return {
		findGroup: () => okAsync({ id: "g1" }),
		findPlayerIds: () => okAsync(playerIds),
		upsertChips: () => okAsync<void, AppError>(undefined),
		deleteChips: () => okAsync<void, AppError>(undefined),
		...overrides,
	};
}

describe("updateChips", () => {
	it("グループが存在しない場合は404を返す", async () => {
		const repo = makeRepo({ findGroup: () => okAsync(null) });
		const result = await updateChips(repo, "g1", {
			chips: [{ playerId: "p1", count: 0 }],
		});
		expect(result._unsafeUnwrapErr()).toMatchObject({ status: 404 });
	});

	it("グループに属さないplayerIdは422を返す", async () => {
		const repo = makeRepo();
		const result = await updateChips(repo, "g1", {
			chips: [
				{ playerId: "unknown", count: 3 },
				{ playerId: "p2", count: -3 },
			],
		});
		expect(result._unsafeUnwrapErr()).toBeInstanceOf(AppError);
	});

	it("チップ収支の合計が0でない場合は422を返す", async () => {
		const repo = makeRepo();
		const result = await updateChips(repo, "g1", {
			chips: [
				{ playerId: "p1", count: 5 },
				{ playerId: "p2", count: -3 },
			],
		});
		expect(result._unsafeUnwrapErr().message).toMatch(/合計は0/);
	});

	it("正常な入力でupsertChipsを呼び出す", async () => {
		let upserted: { playerId: string; count: number }[] | null = null;
		const repo = makeRepo({
			upsertChips: (_groupId, chips) => {
				upserted = chips;
				return okAsync<void, AppError>(undefined);
			},
		});
		const chips = [
			{ playerId: "p1", count: 3 },
			{ playerId: "p2", count: -3 },
		];
		const result = await updateChips(repo, "g1", { chips });
		expect(result.isOk()).toBe(true);
		expect(upserted).toEqual(chips);
	});

	it("チップ収支の合計が0であれば全員0でも正常に通る", async () => {
		const repo = makeRepo();
		const result = await updateChips(repo, "g1", {
			chips: playerIds.map((playerId) => ({ playerId, count: 0 })),
		});
		expect(result.isOk()).toBe(true);
	});
});

describe("resetChips", () => {
	it("グループが存在しない場合は404を返す", async () => {
		const repo = makeRepo({ findGroup: () => okAsync(null) });
		const result = await resetChips(repo, "g1");
		expect(result._unsafeUnwrapErr()).toMatchObject({ status: 404 });
	});

	it("正常にdeleteChipsを呼び出す", async () => {
		let deleted = false;
		const repo = makeRepo({
			deleteChips: () => {
				deleted = true;
				return okAsync<void, AppError>(undefined);
			},
		});
		const result = await resetChips(repo, "g1");
		expect(result.isOk()).toBe(true);
		expect(deleted).toBe(true);
	});
});
