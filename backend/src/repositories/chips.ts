import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { ChipRepo } from "../services/chips";

type Db = ReturnType<typeof drizzle>;

export function createChipRepository(db: Db): ChipRepo {
	return {
		async findGroup(groupId) {
			const [group] = await db
				.select({ id: schema.groups.id })
				.from(schema.groups)
				.where(eq(schema.groups.id, groupId))
				.limit(1);
			return group ?? null;
		},

		async findPlayerIds(groupId) {
			const players = await db
				.select({ id: schema.players.id })
				.from(schema.players)
				.where(eq(schema.players.group_id, groupId));
			return players.map((p) => p.id);
		},

		async upsertChips(groupId, chips) {
			await Promise.all(
				chips.map((chip) =>
					db
						.insert(schema.chip_totals)
						.values({
							id: crypto.randomUUID(),
							group_id: groupId,
							player_id: chip.playerId,
							chips: chip.count,
						})
						.onConflictDoUpdate({
							target: [
								schema.chip_totals.group_id,
								schema.chip_totals.player_id,
							],
							set: { chips: chip.count },
						}),
				),
			);
		},

		async deleteChips(groupId) {
			await db
				.delete(schema.chip_totals)
				.where(eq(schema.chip_totals.group_id, groupId));
		},
	};
}
