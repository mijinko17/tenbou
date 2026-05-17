import { describe, expect, it } from "vitest";
import type { Group } from "./group";
import {
	validatePlayerIds,
	validateSum,
	validateTies,
	validateTobi,
} from "./round";

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

const playerIds = new Set(["p1", "p2", "p3", "p4"]);

describe("validateSum", () => {
	it("素点の合計が genten*4 に一致すれば ok", () => {
		const results = [
			{ rawPoints: 40000 },
			{ rawPoints: 30000 },
			{ rawPoints: 20000 },
			{ rawPoints: 10000 },
		];
		expect(validateSum(baseGroup, results).isOk()).toBe(true);
	});

	it("素点の合計が不正な場合は err", () => {
		const results = [
			{ rawPoints: 40000 },
			{ rawPoints: 30000 },
			{ rawPoints: 20000 },
			{ rawPoints: 9999 },
		];
		const result = validateSum(baseGroup, results);
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toMatch(/素点の合計/);
	});
});

describe("validatePlayerIds", () => {
	it("全プレイヤーIDがグループに属する場合は ok", () => {
		const results = [
			{ playerId: "p1" },
			{ playerId: "p2" },
			{ playerId: "p3" },
			{ playerId: "p4" },
		];
		expect(validatePlayerIds(results, playerIds).isOk()).toBe(true);
	});

	it("グループに属さない playerId が含まれる場合は err", () => {
		const results = [
			{ playerId: "p1" },
			{ playerId: "p2" },
			{ playerId: "p3" },
			{ playerId: "unknown" },
		];
		const result = validatePlayerIds(results, playerIds);
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toMatch(/Invalid playerId/);
	});
});

describe("validateTies", () => {
	it("同点なし・rankOrderなしは ok", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 40000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: 10000 },
			],
		};
		expect(validateTies(input).isOk()).toBe(true);
	});

	it("同点プレイヤーがいて rankOrder がない場合は err", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 40000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 30000 },
				{ playerId: "p4", rawPoints: 0 },
			],
		};
		const result = validateTies(input);
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toMatch(/順位を指定/);
	});

	it("同点プレイヤーがいて有効な rankOrder がある場合は ok", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 40000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 30000 },
				{ playerId: "p4", rawPoints: 0 },
			],
			rankOrder: ["p1", "p2", "p3", "p4"],
		};
		expect(validateTies(input).isOk()).toBe(true);
	});

	it("rankOrder に無効なプレイヤーIDが含まれる場合は err", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 40000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 30000 },
				{ playerId: "p4", rawPoints: 0 },
			],
			rankOrder: ["p1", "p2", "unknown", "p4"],
		};
		const result = validateTies(input);
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toMatch(/無効なプレイヤーID/);
	});

	it("rankOrder の順序が点数と矛盾する場合は err", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 40000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: 10000 },
			],
			// p4（10000）が p3（20000）より先は矛盾
			rankOrder: ["p1", "p2", "p4", "p3"],
		};
		const result = validateTies(input);
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toMatch(/矛盾/);
	});
});

describe("validateTobi", () => {
	it("飛びなし・tobiKillerIdなしは ok", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 40000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: 10000 },
			],
		};
		expect(validateTobi(input, playerIds).isOk()).toBe(true);
	});

	it("飛びプレイヤーがいて tobiKillerId がない場合は ok（トビ賞なしとして扱う）", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 60000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: -10000 },
			],
		};
		expect(validateTobi(input, playerIds).isOk()).toBe(true);
	});

	it("飛びプレイヤーがいて有効な tobiKillerId がある場合は ok", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 60000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: -10000 },
			],
			tobiKillerId: "p1",
		};
		expect(validateTobi(input, playerIds).isOk()).toBe(true);
	});

	it("tobiKillerId が飛んだプレイヤー自身の場合は err", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 60000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: -10000 },
			],
			tobiKillerId: "p4",
		};
		const result = validateTobi(input, playerIds);
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toMatch(/自身/);
	});

	it("tobiKillerId がグループに属さない場合は err", () => {
		const input = {
			results: [
				{ playerId: "p1", rawPoints: 60000 },
				{ playerId: "p2", rawPoints: 30000 },
				{ playerId: "p3", rawPoints: 20000 },
				{ playerId: "p4", rawPoints: -10000 },
			],
			tobiKillerId: "unknown",
		};
		const result = validateTobi(input, playerIds);
		expect(result.isErr()).toBe(true);
		expect(result._unsafeUnwrapErr().message).toMatch(/Invalid tobiKillerId/);
	});
});
