import { error } from "@sveltejs/kit";
import { loadSaveGame } from "$lib/data/store";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
	const save = loadSaveGame();

	if (!save) {
		throw error(404, "No save game found");
	}

	// Get active league based on query param or default to manager's team league
	let activeLeagueId = url.searchParams.get("id");

	if (!activeLeagueId) {
		const managerTeam = save.teams[save.manager.teamId];
		if (managerTeam) {
			const league = save.leagues.find((l) => l.teams.includes(managerTeam.id));
			if (league) {
				activeLeagueId = league.id;
			}
		}
	}

	if (!activeLeagueId && save.leagues.length > 0) {
		activeLeagueId = save.leagues[0].id;
	}

	const activeLeague = save.leagues.find((l) => l.id === activeLeagueId);
	if (!activeLeague) {
		throw error(404, "League not found");
	}

	// Filter fixtures to only this league
	const leagueFixtures = save.fixtures.filter((f) =>
		activeLeague.teams.includes(f.homeTeamId),
	);

	// Extract Player Stats for the active league
	const leaguePlayers: ((typeof save.players)[string] & {
		teamId: string;
		teamName: string;
	})[] = [];

	for (const teamId of activeLeague.teams) {
		const team = save.teams[teamId];
		if (team) {
			for (const playerId of team.players) {
				const player = save.players[playerId];
				if (player) {
					leaguePlayers.push({
						...player,
						teamId: team.id,
						teamName: team.name,
					});
				}
			}
		}
	}

	const topScorers = [...leaguePlayers]
		.filter((p) => p.seasonStats && p.seasonStats.goals > 0)
		.sort((a, b) => b.seasonStats!.goals - a.seasonStats!.goals)
		.slice(0, 10);

	const topAssists = [...leaguePlayers]
		.filter((p) => p.seasonStats && p.seasonStats.assists > 0)
		.sort((a, b) => b.seasonStats!.assists - a.seasonStats!.assists)
		.slice(0, 10);

	const topCleanSheets = [...leaguePlayers]
		.filter(
			(p) => p.role === "GK" && p.seasonStats && p.seasonStats.cleanSheets > 0,
		)
		.sort((a, b) => b.seasonStats!.cleanSheets - a.seasonStats!.cleanSheets)
		.slice(0, 5);

	return {
		save, // Passing entire save for team names/data, might want to optimize later
		leagues: save.leagues.map((l) => ({ id: l.id, name: l.name })),
		activeLeagueId,
		activeLeague,
		leagueFixtures,
		managerTeamId: save.manager.teamId,
		currentWeek: save.currentWeek,
		stats: {
			topScorers,
			topAssists,
			topCleanSheets,
		},
	};
};
