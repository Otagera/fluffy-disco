import { loadSaveGame } from "$lib/data/store";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const save = loadSaveGame();

	if (!save) {
		return {
			hasSave: false,
			teams: [],
			players: {},
			scoutingReports: [],
			managerTeamId: "",
			currentDate: "",
		};
	}

	return {
		hasSave: true,
		managerTeamId: save.manager.teamId,
		teams: Object.values(save.teams),
		players: save.players,
		currentDate: save.currentDate,
		scoutingReports: save.scoutingReports || [],
	};
};
