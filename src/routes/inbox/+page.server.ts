import { error, fail } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "$lib/data/db";
import { calculatePlayerValue } from "$lib/data/ratings";
import * as schema from "$lib/data/schema";
import { loadSaveGame, writeSaveGame } from "$lib/data/store";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const save = loadSaveGame();

	if (!save) {
		throw error(404, "No save game found");
	}

	const messages = db
		.select()
		.from(schema.inboxMessages)
		.where(eq(schema.inboxMessages.teamId, save.manager.teamId))
		.orderBy(schema.inboxMessages.date) // DESC handled in logic or SQL
		.all();

	// Reverse to get newest first if not using orderBy DESC
	messages.reverse();

	// Load League News Feed
	const managerTeamId = save.manager.teamId;
	const activeLeague = save.leagues.find((l) =>
		l.teams.includes(managerTeamId),
	);
	const leagueNews = activeLeague?.news || [];

	return {
		messages,
		leagueNews: leagueNews.sort((a, b) => b.week - a.week),
		players: save.players,
		scoutingReports: save.scoutingReports || [],
		managerTeamId: save.manager.teamId,
		currentDate: save.currentDate,
	};
};

export const actions: Actions = {
	markRead: async ({ request }) => {
		const data = await request.formData();
		const id = data.get("id")?.toString();

		if (!id) return fail(400, { message: "Missing message ID" });

		db.update(schema.inboxMessages)
			.set({ isRead: true })
			.where(eq(schema.inboxMessages.id, id))
			.run();

		return { success: true };
	},
	deleteMessage: async ({ request }) => {
		const data = await request.formData();
		const id = data.get("id")?.toString();

		if (!id) return fail(400, { message: "Missing message ID" });

		db.delete(schema.inboxMessages)
			.where(eq(schema.inboxMessages.id, id))
			.run();

		return { success: true };
	},
	completeTransfer: async ({ request }) => {
		const data = await request.formData();
		const messageId = data.get("messageId")?.toString();
		const relatedEntityId = data.get("relatedEntityId")?.toString();

		if (
			!messageId ||
			!relatedEntityId ||
			!relatedEntityId.startsWith("offer_")
		) {
			return fail(400, { message: "Invalid transfer data" });
		}

		const save = loadSaveGame();
		if (!save) return fail(500, { message: "No save found" });

		const [_, playerId, amountStr] = relatedEntityId.split("_");
		const amount = Number(amountStr);
		const player = save.players[playerId];

		if (!player) return fail(404, { message: "Player not found" });

		const buyingTeam = save.teams[save.manager.teamId];
		const sellingTeam = save.teams[player.teamId!];

		if (!sellingTeam) return fail(500, { message: "Selling team not found" });

		// Financials
		if (buyingTeam.transferBudget && buyingTeam.transferBudget < amount) {
			return fail(400, { message: "Insufficient transfer budget" });
		}

		buyingTeam.transferBudget = (buyingTeam.transferBudget || 0) - amount;
		sellingTeam.transferBudget = (sellingTeam.transferBudget || 0) + amount;

		// Move Player
		sellingTeam.players = sellingTeam.players.filter((id) => id !== playerId);
		buyingTeam.players.push(playerId);
		player.teamId = buyingTeam.id;

		// New Contract: 3 years from current date
		const d = new Date(save.currentDate);
		d.setFullYear(d.getFullYear() + 3);
		player.contractExpires = d.toISOString().split("T")[0];

		// Set market wage
		const marketValue = calculatePlayerValue(player, save.currentDate);
		player.wage = Math.round(marketValue / 100);

		// Persist
		writeSaveGame(save);

		// Delete or mark message as completed
		db.update(schema.inboxMessages)
			.set({ relatedEntityId: `completed_${playerId}` }) // break the link so button disappears
			.where(eq(schema.inboxMessages.id, messageId))
			.run();

		return { success: true };
	},
	acceptCpuOffer: async ({ request }) => {
		const data = await request.formData();
		const messageId = data.get("messageId")?.toString();
		const relatedEntityId = data.get("relatedEntityId")?.toString();

		if (
			!messageId ||
			!relatedEntityId ||
			!relatedEntityId.startsWith("cpuoffer_")
		) {
			return fail(400, { message: "Invalid transfer data" });
		}

		const save = loadSaveGame();
		if (!save) return fail(500, { message: "No save found" });

		// Format: cpuoffer_playerId_amount_buyingTeamId
		const parts = relatedEntityId.split("_");
		const playerId = parts[1];
		const amount = Number(parts[2]);
		const buyingTeamId = parts[3];

		const player = save.players[playerId];
		if (!player) return fail(404, { message: "Player not found" });

		const sellingTeam = save.teams[save.manager.teamId];
		const buyingTeam = save.teams[buyingTeamId];

		if (!buyingTeam || !sellingTeam)
			return fail(500, { message: "Teams not found" });

		// Financials
		if (buyingTeam.transferBudget && buyingTeam.transferBudget < amount) {
			return fail(400, { message: "Insufficient transfer budget" });
		}

		buyingTeam.transferBudget = (buyingTeam.transferBudget || 0) - amount;
		sellingTeam.transferBudget = (sellingTeam.transferBudget || 0) + amount;

		// Move Player
		sellingTeam.players = sellingTeam.players.filter((id) => id !== playerId);
		buyingTeam.players.push(playerId);
		player.teamId = buyingTeam.id;

		// New Contract: 3 years from current date
		const d = new Date(save.currentDate);
		d.setFullYear(d.getFullYear() + 3);
		player.contractExpires = d.toISOString().split("T")[0];

		// Set market wage
		const marketValue = calculatePlayerValue(player, save.currentDate);
		player.wage = Math.round(marketValue / 100);

		// Persist
		writeSaveGame(save);

		// Update message
		db.update(schema.inboxMessages)
			.set({
				relatedEntityId: `completed_${playerId}`,
				body: `You have accepted the offer from ${buyingTeam.name}. The transfer of ${player.name} has been completed.`,
			})
			.where(eq(schema.inboxMessages.id, messageId))
			.run();

		return { success: true };
	},
	rejectCpuOffer: async ({ request }) => {
		const data = await request.formData();
		const messageId = data.get("messageId")?.toString();

		if (!messageId) return fail(400, { message: "Missing message ID" });

		db.update(schema.inboxMessages)
			.set({
				relatedEntityId: `rejected`,
				body: `You rejected the offer.`,
			})
			.where(eq(schema.inboxMessages.id, messageId))
			.run();

		return { success: true };
	},
};
