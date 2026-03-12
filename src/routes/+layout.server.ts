import { and, count, eq } from "drizzle-orm";
import { db } from "$lib/data/db";
import * as schema from "$lib/data/schema";
import { loadSaveGame } from "$lib/data/store";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async () => {
	const save = loadSaveGame();

	if (!save) {
		return {
			hasSave: false,
			currentDate: "",
			managerTeamId: "",
			unreadInboxCount: 0,
		};
	}

	const unreadInboxCount = db
		.select({ value: count() })
		.from(schema.inboxMessages)
		.where(
			and(
				eq(schema.inboxMessages.teamId, save.manager.teamId),
				eq(schema.inboxMessages.isRead, false),
			),
		)
		.get();

	return {
		hasSave: true,
		manager: save.manager,
		managerTeamId: save.manager.teamId,
		currentDate: save.currentDate,
		unreadInboxCount: unreadInboxCount?.value || 0,
		shortlist: save.shortlist || [],
	};
};
