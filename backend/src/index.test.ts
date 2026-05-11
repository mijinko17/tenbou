import { describe, expect, it } from "vitest";
import app from "./index";

describe("GET /", () => {
	it("returns ok", async () => {
		const res = await app.request("/");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json).toEqual({ status: "ok" });
	});
});
