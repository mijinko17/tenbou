import { describe, expect, it } from "vitest";
import app from "./index";

const mockDB = {
	prepare: (_sql: string) => ({
		bind: (..._args: unknown[]) => ({
			first: async () => null,
			all: async () => ({ results: [], success: true, meta: {} }),
			run: async () => ({ success: true, meta: {} }),
		}),
		first: async () => null,
		all: async () => ({ results: [], success: true, meta: {} }),
		run: async () => ({ success: true, meta: {} }),
	}),
	batch: async (_statements: unknown[]) => [],
	exec: async (_sql: string) => ({ count: 0, duration: 0 }),
	dump: async () => new ArrayBuffer(0),
} as unknown as D1Database;

const mockEnv = {
	DB: mockDB,
	CREATION_PASSWORD: "test-password",
};

describe("GET /", () => {
	it("returns ok", async () => {
		const res = await app.request("/");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "ok" });
	});
});

describe("POST /groups", () => {
	const validBody = {
		name: "テストグループ",
		players: ["Alice", "Bob", "Charlie", "Dave"],
		rate: 50,
		chipRate: 2,
		uma: [20, 10, -10, -20],
		genten: 25,
		kaeshi: 30,
	};

	it("returns 401 when key is missing", async () => {
		const res = await app.request(
			"/groups",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			},
			mockEnv,
		);
		expect(res.status).toBe(401);
	});

	it("returns 401 when key is wrong", async () => {
		const res = await app.request(
			"/groups?key=wrong",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			},
			mockEnv,
		);
		expect(res.status).toBe(401);
	});

	it("returns 400 when uma sum != 0", async () => {
		const res = await app.request(
			"/groups?key=test-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...validBody, uma: [20, 10, -10, -10] }),
			},
			mockEnv,
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 when too few players", async () => {
		const res = await app.request(
			"/groups?key=test-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...validBody,
					players: ["Alice", "Bob", "Charlie"],
				}),
			},
			mockEnv,
		);
		expect(res.status).toBe(400);
	});

	it("returns 201 with valid body and correct key", async () => {
		const res = await app.request(
			"/groups?key=test-password",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			},
			mockEnv,
		);
		expect(res.status).toBe(201);
		const json = (await res.json()) as { groupId: string; inviteToken: string };
		expect(json.groupId).toMatch(/^[0-9a-f-]{36}$/);
		expect(json.inviteToken).toMatch(/^[0-9a-f-]{36}$/);
	});
});

describe("GET /invite/:token", () => {
	it("returns 404 for unknown token", async () => {
		const res = await app.request("/invite/nonexistent-token", {}, mockEnv);
		expect(res.status).toBe(404);
	});
});
