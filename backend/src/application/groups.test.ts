import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";
import type { Group } from "../domain/group";
import type {
	AdvancePaymentData,
	GroupRepository,
	RoundData,
} from "../domain/repositories/group";
import type { AppError } from "../errors";
import { createGroup, getGroup } from "./groups";

const baseGroup: Group = {
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

const players = [
	{ id: "p1", name: "太郎" },
	{ id: "p2", name: "次郎" },
	{ id: "p3", name: "三郎" },
	{ id: "p4", name: "四郎" },
];

const emptyRounds: RoundData[] = [];
const emptyChips: { playerId: string; count: number }[] = [];
const emptyAdvancePayments: AdvancePaymentData[] = [];

function makeRepo(overrides?: Partial<GroupRepository>): GroupRepository {
	return {
		createGroup: () => okAsync<void, AppError>(undefined),
		findGroup: () => okAsync(baseGroup),
		findPlayers: () => okAsync(players),
		findRoundsWithResults: () => okAsync(emptyRounds),
		findChips: () => okAsync(emptyChips),
		findAdvancePayments: () => okAsync(emptyAdvancePayments),
		...overrides,
	};
}

describe("createGroup", () => {
	it("ウマの合計が0でない場合は422を返す", async () => {
		const repo = makeRepo();
		const result = await createGroup(repo, {
			name: "テスト",
			players: ["p1", "p2", "p3", "p4"],
			rate: 50,
			chipRate: 2,
			uma: [20, 10, -10, -10] as [number, number, number, number], // 合計10
			tobi: 10,
			genten: 25000,
			kaeshi: 30000,
		});
		expect(result._unsafeUnwrapErr().message).toMatch(/ウマの合計は0/);
	});

	it("グループを作成してgroupIdを返す", async () => {
		const calls: Parameters<GroupRepository["createGroup"]>[0][] = [];
		const repo = makeRepo({
			createGroup: (data) => {
				calls.push(data);
				return okAsync<void, AppError>(undefined);
			},
		});
		const input = {
			name: "身内セット",
			players: ["太郎", "次郎", "三郎", "四郎"],
			rate: 50,
			chipRate: 2,
			uma: [20, 10, -10, -20] as [number, number, number, number],
			tobi: 10,
			genten: 25000,
			kaeshi: 30000,
		};
		const result = await createGroup(repo, input);
		const { groupId } = result._unsafeUnwrap();
		expect(groupId).toMatch(/^[0-9a-f-]{36}$/);
		expect(calls).toHaveLength(1);
		const created = calls[0];
		expect(created.name).toBe("身内セット");
		expect(created.players).toHaveLength(4);
		expect(created.players[0].name).toBe("太郎");
		expect(created.players[0].id).toMatch(/^[0-9a-f-]{36}$/);
	});
});

describe("getGroup", () => {
	it("グループが存在しない場合は404を返す", async () => {
		const repo = makeRepo({ findGroup: () => okAsync(null) });
		const result = await getGroup(repo, "g1");
		expect(result._unsafeUnwrapErr()).toMatchObject({ status: 404 });
	});

	it("ラウンドなし・チップなしの場合に正常に返す", async () => {
		const repo = makeRepo();
		const result = await getGroup(repo, "g1");
		const value = result._unsafeUnwrap();
		expect(value.group).toEqual(baseGroup);
		expect(value.players).toEqual(players);
		expect(value.rounds).toHaveLength(0);
		expect(value.chips).toHaveLength(0);
		expect(value.advancePayments).toHaveLength(0);
	});

	it("ラウンドがある場合にscoreが計算されて返る", async () => {
		const round: RoundData = {
			id: "r1",
			roundNo: 1,
			playedAt: "2024-01-01",
			tobiKillerId: null,
			rankOrder: null,
			results: [
				{ playerId: "p1", rawPoints: 40000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: 10000 },
			],
		};
		const repo = makeRepo({ findRoundsWithResults: () => okAsync([round]) });
		const result = await getGroup(repo, "g1");
		const value = result._unsafeUnwrap();
		expect(value.rounds).toHaveLength(1);
		const scores = value.rounds[0].results;
		// 全員に score が付いていること
		for (const s of scores) {
			expect(typeof s.score).toBe("number");
		}
		// 1位（p1）の score が最大
		const p1Score = scores.find((s) => s.playerId === "p1")?.score;
		const p4Score = scores.find((s) => s.playerId === "p4")?.score;
		expect(p1Score).toBeDefined();
		expect(p4Score).toBeDefined();
		expect(p1Score).toBeGreaterThan(p4Score as number);
	});

	it("チップと立替払いが返る", async () => {
		const chips = [{ playerId: "p1", count: 5 }];
		const advancePayments: AdvancePaymentData[] = [
			{
				id: "ap1",
				payerId: "p1",
				beneficiaryIds: ["p2", "p3"],
				description: "飲み代",
				amount: 3000,
				createdAt: 1700000000,
			},
		];
		const repo = makeRepo({
			findChips: () => okAsync(chips),
			findAdvancePayments: () => okAsync(advancePayments),
		});
		const result = await getGroup(repo, "g1");
		const value = result._unsafeUnwrap();
		expect(value.chips).toEqual(chips);
		expect(value.advancePayments).toEqual(advancePayments);
	});
});
