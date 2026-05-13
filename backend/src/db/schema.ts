import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const groups = sqliteTable("groups", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	rate: integer("rate").notNull().default(50),
	chip_rate: integer("chip_rate").notNull().default(2000),
	uma_1: integer("uma_1").notNull().default(20),
	uma_2: integer("uma_2").notNull().default(10),
	uma_3: integer("uma_3").notNull().default(-10),
	uma_4: integer("uma_4").notNull().default(-20),
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
