import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { loadSaveGame, writeSaveGame, addInboxMessage } from '$lib/data/store';
import { calculatePlayerValue } from '$lib/data/ratings';

export const load: PageServerLoad = async ({ params }) => {
  const save = loadSaveGame();

  if (!save) {
    return {
      hasSave: false
    };
  }

  const team = save.teams[params.id];
  if (!team) {
    throw error(404, 'Team not found');
  }

  // Only pass the players that belong to this team to save bandwidth
  const teamPlayers = team.players.map((id) => save.players[id]).filter(Boolean);

  return {
    hasSave: true,
    team,
    players: teamPlayers,
    managerTeamId: save.manager.teamId,
    currentDate: save.currentDate
  };
};

export const actions: Actions = {
  saveTactics: async ({ request }) => {
    const data = await request.formData();
    const formation = data.get('formation') as string;
    const playerIdsJson = data.get('playerIds') as string;

    if (!formation || !playerIdsJson) {
      return fail(400, { message: 'Missing data' });
    }

    const save = loadSaveGame();
    if (!save) return fail(500, { message: 'No save found' });

    // Ensure we are only editing the manager's team
    const team = save.teams[save.manager.teamId];
    team.formation = formation;
    team.players = JSON.parse(playerIdsJson);

    writeSaveGame(save);

    return { success: true };
  },
  submitTransferBid: async ({ request, params }) => {
    const data = await request.formData();
    const playerId = data.get('playerId') as string;
    const amount = Number(data.get('amount'));

    if (!playerId || !amount) return fail(400, { message: 'Missing data' });

    const save = loadSaveGame();
    if (!save) return fail(500, { message: 'No save found' });

    const player = save.players[playerId];
    const sellingTeam = save.teams[params.id];
    
    if (!player || !sellingTeam) return fail(404, { message: 'Player or team not found' });

    const value = calculatePlayerValue(player, save.currentDate);
    const formatter = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

    // A simple AI negotiation: if you bid at least 95% of the value, they accept.
    const isAccepted = amount >= value * 0.95;

    const body = isAccepted 
      ? `We have received your offer of ${formatter.format(amount)} for ${player.name}.\n\nThe board has reviewed the financials and we are happy to accept this bid. You may proceed with the transfer when ready.`
      : `We have received your offer of ${formatter.format(amount)} for ${player.name}.\n\nUnfortunately, this falls short of our valuation for the player. We expect a bid closer to ${formatter.format(value)} before we consider selling.`;

    addInboxMessage(save, {
      teamId: save.manager.teamId,
      date: save.currentDate,
      sender: sellingTeam.name,
      subject: `Transfer Offer ${isAccepted ? 'Accepted' : 'Rejected'}: ${player.name}`,
      body: body,
      type: 'TRANSFER',
      isUrgent: true,
      relatedEntityId: isAccepted ? `offer_${player.id}_${amount}` : undefined
    });

    return { success: true };
  }
};