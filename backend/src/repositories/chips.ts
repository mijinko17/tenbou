import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/d1";
import { ResultAsync } from "neverthrow";
import * as schema from "../db/schema";
import { AppError } from "../errors";
import type { ChipRepo } from "../services/chips";

type Db = ReturnType<typeof drizzle>;

const dbErr = (e: unknown) => new AppError(String(e), 500);

export function createChipRepository(db: Db): ChipRepo {
	return {
		findGroup(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.groups.id })
					.from(schema.groups)
					.where(eq(schema.groups.id, groupId))
					.limit(1)
					.then(([group]) => group ?? null),
				dbErr,
			);
		},

		findPlayerIds(groupId) {
			return ResultAsync.fromPromise(
				db
					.select({ id: schema.players.id })
					.from(schema.players)
					.where(eq(schema.players.group_id, groupId))
					.then((players) => players.map((p) => p.id)),
				dbErr,
			);
		},

		upsertChips(groupId, chips) {
			return ResultAsync.fromPromise(
				Promise.all(
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
				).then(() => undefined),
				dbErr,
			);
		},

		deleteChips(groupId) {
			return ResultAsync.fromPromise(
				db
					.delete(schema.chip_totals)
					.where(eq(schema.chip_totals.group_id, groupId))
					.then(() => undefined),
				dbErr,
			);
		},
	};
}
