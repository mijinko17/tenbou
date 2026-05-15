import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const groups = sqliteTable("groups", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	rate: integer("rate").notNull().default(50),
	chip_rate: integer("chip_rate").notNull().default(2000),
	uma_1: integer("uma_1").notNull().default(20),
	uma_2: integer("uma_2").notNull().default(10),
	uma_3: integer("uma_3").notNull().default(-10),
	uma_4: integer("uma_4").notNull().default(-20),
	tobi: integer("tobi").notNull().default(10),
	genten: integer("genten").notNull().default(25000),
	kaeshi: integer("kaeshi").notNull().default(30000),
	created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const players = sqliteTable("players", {
	id: text("id").primaryKey(),
	group_id: text("group_id")
		.notNull()
		.references(() => groups.id),
	name: text("name").notNull(),
	created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const invite_tokens = sqliteTable("invite_tokens", {
	token: text("token").primaryKey(),
	group_id: text("group_id")
		.notNull()
		.references(() => groups.id),
	expires_at: text("expires_at").notNull(),
	created_at: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const sessions = sqliteTable("sessions", {
	token: text("token").primaryKey(),
	player_id: text("player_id")
		.notNull()
		.references(() => players.id),
	expires_at: text("expires_at").notNull(),
});

export const game_rounds = sqliteTable("game_rounds", {
	id: text("id").primaryKey(),
	group_id: text("group_id")
		.notNull()
		.references(() => groups.id),
	round_no: integer("round_no").notNull(),
	tobi_killer_id: text("tobi_killer_id").references(() => players.id),
	rank_order: text("rank_order"), // JSON array of playerIds in rank order (1st→4th). NULL = sort by rawPoints
	played_at: text("played_at").notNull().default(sql`(datetime('now'))`),
});

export const chip_totals = sqliteTable(
	"chip_totals",
	{
		id: text("id").primaryKey(),
		group_id: text("group_id")
			.notNull()
			.references(() => groups.id),
		player_id: text("player_id")
			.notNull()
			.references(() => players.id),
		chips: integer("chips").notNull().default(0),
	},
	(table) => [unique().on(table.group_id, table.player_id)],
);

export const game_results = sqliteTable(
	"game_results",
	{
		id: text("id").primaryKey(),
		round_id: text("round_id")
			.notNull()
			.references(() => game_rounds.id),
		player_id: text("player_id")
			.notNull()
			.references(() => players.id),
		raw_points: integer("raw_points").notNull(),
	},
	(table) => [unique().on(table.round_id, table.player_id)],
);
