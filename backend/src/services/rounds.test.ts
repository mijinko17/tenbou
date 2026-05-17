import { describe, expect, it } from "vitest";
import { AppError } from "../errors";
import { createRound, deleteRound, type RoundRepo } from "./rounds";

const baseGroup = {
	id: "g1",
	name: "テスト",
	rate: 50,
	chip_rate: 2,
	uma_1: 20,
	uma_2: 10,
	uma_3: -10,
	uma_4: -20,
	tobi: 10,
	genten: 25000,
	kaeshi: 30000,
	created_at: "2024-01-01",
};

const playerIds = ["p1", "p2", "p3", "p4"];

function makeRepo(overrides?: Partial<RoundRepo>): RoundRepo {
	return {
		findGroup: async () => baseGroup,
		findPlayerIds: async () => playerIds,
		countRounds: async () => 0,
		createRound: async () => {},
		findRound: async () => ({ id: "r1" }),
		deleteRound: async () => {},
		...overrides,
	};
}

// 素点合計 = 25000 * 4 = 100000
const validResults = [
	{ playerId: "p1", rawPoints: 40000 },
	{ playerId: "p2", rawPoints: 30000 },
	{ playerId: "p3", rawPoints: 20000 },
	{ playerId: "p4", rawPoints: 10000 },
];

describe("createRound", () => {
	it("グループが存在しない場合は404を投げる", async () => {
		const repo = makeRepo({ findGroup: async () => null });
		await expect(
			createRound(repo, "g1", { results: validResults }),
		).rejects.toMatchObject({ status: 404 });
	});

	it("素点合計が不正な場合は422を投げる", async () => {
		const repo = makeRepo();
		const badResults = [...validResults];
		badResults[0] = { playerId: "p1", rawPoints: 99999 };
		await expect(
			createRound(repo, "g1", { results: badResults }),
		).rejects.toThrow(/素点の合計/);
	});

	it("グループに属さないplayerIdは422を投げる", async () => {
		const repo = makeRepo();
		const badResults = validResults.map((r, i) =>
			i === 0 ? { ...r, playerId: "unknown" } : r,
		);
		await expect(
			createRound(repo, "g1", { results: badResults }),
		).rejects.toThrow(AppError);
	});

	it("同点プレイヤーがいてrankOrderなしの場合は422を投げる", async () => {
		const repo = makeRepo();
		const tiedResults = [
			{ playerId: "p1", rawPoints: 40000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: 10000 },
		];
		// 同点にする
		tiedResults[2].rawPoints = 30000;
		tiedResults[3].rawPoints = 0;
		// sum: 40000 + 30000 + 30000 + 0 = 100000 ✓
		await expect(
			createRound(repo, "g1", { results: tiedResults }),
		).rejects.toThrow(/順位を指定/);
	});

	it("rankOrderの順位が点数と矛盾する場合は422を投げる", async () => {
		const repo = makeRepo();
		await expect(
			createRound(repo, "g1", {
				results: validResults,
				// p4（10000）が1位になっておりp1（40000）より先に来る矛盾
				rankOrder: ["p4", "p3", "p2", "p1"],
			}),
		).rejects.toThrow(/矛盾/);
	});

	it("飛びプレイヤーがいてtobiKillerIdなしの場合は422を投げる", async () => {
		const repo = makeRepo();
		const tobiResults = [
			{ playerId: "p1", rawPoints: 60000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: -10000 }, // 飛び
		];
		// sum = 100000 ✓
		await expect(
			createRound(repo, "g1", { results: tobiResults }),
		).rejects.toThrow(/飛ばしたプレイヤー/);
	});

	it("飛ばしたプレイヤーが飛んだプレイヤー自身の場合は422を投げる", async () => {
		const repo = makeRepo();
		const tobiResults = [
			{ playerId: "p1", rawPoints: 60000 },
			{ playerId: "p2", rawPoints: 30000 },
			{ playerId: "p3", rawPoints: 20000 },
			{ playerId: "p4", rawPoints: -10000 },
		];
		await expect(
			createRound(repo, "g1", {
				results: tobiResults,
				tobiKillerId: "p4", // 飛んだ本人を指定
			}),
		).rejects.toThrow(/自身/);
	});

	it("正常な入力でroundIdとroundNoを返す", async () => {
		let savedData: Parameters<RoundRepo["createRound"]>[0] | null = null;
		const repo = makeRepo({
			countRounds: async () => 2,
			createRound: async (data) => {
				savedData = data;
			},
		});

		const result = await createRound(repo, "g1", { results: validResults });

		expect(result.roundId).toMatch(/^[0-9a-f-]{36}$/);
		expect(result.roundNo).toBe(3);
		expect(savedData).not.toBeNull();
		expect(savedData?.results).toHaveLength(4);
	});
});

describe("deleteRound", () => {
	it("ラウンドが存在しない場合は404を投げる", async () => {
		const repo = makeRepo({ findRound: async () => null });
		await expect(deleteRound(repo, "g1", "r1")).rejects.toMatchObject({
			status: 404,
		});
	});

	it("正常に削除する", async () => {
		let deleted = false;
		const repo = makeRepo({ deleteRound: async () => { deleted = true; } });
		await deleteRound(repo, "g1", "r1");
		expect(deleted).toBe(true);
	});
});
