import { Match, MatchStatus } from "../Match.svelte.ts";
import { MatchRecorder } from "../MatchRecorder";

let match: Match;
let intervalId: any = null;

// Double buffer pool for transfering state to main thread
// (Removed as 1KB payload cloning is negligible and Transferables add sync complexity)

self.onmessage = (e) => {
	const { type, payload } = e.data;

	if (type === "INIT") {
		console.log(`[Worker] Initializing match ${payload.matchId}...`);
		match = new Match();
		if (payload.matchId) {
			match.recorder = new MatchRecorder(payload.matchId, payload.homeTeamId, payload.awayTeamId);
		}
		match.setup(
			payload.anchors,
			payload.stats,
			payload.roles,
			payload.styles,
			payload.mentalities,
			payload.isKickoff
		);
		if (payload.formations) {
			match.homeFormation = payload.formations[0];
			match.awayFormation = payload.formations[1];
		}
		match.managedTeam = payload.managedTeam;
		
		sendStatus();
	} else if (type === "SET_SPEED") {
		if (intervalId) clearTimeout(intervalId);
		const gameSpeed = payload.speed;
		
		if (gameSpeed > 0) {
			let lastTickTime = performance.now();

			const loop = () => {
				try {
					const now = performance.now();
					const rawDt = (now - lastTickTime) / 1000;
					lastTickTime = now;

					// Cap rawDt to prevent massive leaps if the thread hung
					const safeDt = Math.min(Math.max(0, rawDt), 0.1);

					const isDeadBall = match.status === MatchStatus.SET_PIECE || match.status === MatchStatus.FREE_KICK;
					if (match.status !== MatchStatus.PLAYING && match.status !== MatchStatus.KICKOFF && !isDeadBall) {
						sendStatus();
						intervalId = setTimeout(loop, 100); // Check less frequently when paused
						return;
					}

					let simulatedTime = 0;
					const targetTime = safeDt * gameSpeed;
					const fixedDt = 0.05; // 50ms per step max

					if (targetTime > 0 && !isNaN(targetTime)) {
						let iterations = 0;
						while (simulatedTime < targetTime) {
							const step = Math.min(fixedDt, targetTime - simulatedTime);
							if (step <= 0) break; // safeguard
							match.tick(step);
							simulatedTime += step;
							iterations++;
							
							// If we are doing a lot of iterations (high speed), 
							// don't send status for every single internal micro-tick.
							// Just send one at the end of the loop.
						}
					}

					sendBuffersAndStatus();

					// If running at very high speeds, yield to the event loop so postMessage can flush
					const executionTime = performance.now() - now;
					const nextDelay = Math.max(0, 16 - executionTime);
					intervalId = setTimeout(loop, nextDelay);
				} catch (error: any) {
					console.error("Worker Loop Error:", error);
					self.postMessage({ type: "ERROR", payload: { message: error.message, stack: error.stack } });
				}
			};

			intervalId = setTimeout(loop, 16);
		}
	} else if (type === "START") {
		match.status = MatchStatus.PLAYING;
	} else if (type === "PAUSE") {
		match.status = MatchStatus.PAUSED;
		sendStatus();
	} else if (type === "RESUME") {
		match.status = MatchStatus.PLAYING;
	} else if (type === "SET_BENCH") {
		match.benchStats[payload.team] = payload.stats;
	} else if (type === "SET_BENCH_ROLES") {
		match.benchRoles[payload.team] = payload.roles;
	} else if (type === "MAKE_SUB") {
		match.makeSub(payload.team, payload.outIdx, payload.benchIdx);
		sendBuffersAndStatus();
	} else if (type === "SWAP_PLAYERS") {
		match.swapPlayers(payload.team, payload.idx1, payload.idx2);
		sendBuffersAndStatus();
	} else if (type === "START_SECOND_HALF") {
		match.currentHalf = 2;
		match.currentTime = 2700; // Reset to start of 2nd half
		match.setup(
			payload.anchors,
			payload.stats,
			payload.roles,
			payload.styles,
			payload.mentalities,
			false
		);
		if (payload.formations) {
			match.homeFormation = payload.formations[0];
			match.awayFormation = payload.formations[1];
		}
		// Half-time Stamina Recovery (approx +15%)
		for (let i = 0; i < 22; i++) {
			const offset = i * 11 + 7; // PLAYER_STRIDE=11, STAMINA=7
			const currentStamina = match.memory.playerBuffer[offset];
			match.memory.playerBuffer[offset] = Math.min(1.0, currentStamina + 0.15);
		}
		match.status = MatchStatus.PLAYING; // Start playing immediately or wait for user? The UI has a button.
		sendBuffersAndStatus();
	} else if (type === "TACTICS_UPDATE") {
		if (payload.isHome) {
			match.homeStyle = payload.style;
			match.homeMentality = payload.mentality;
			match.homeFormation = payload.formation;
			match.updateRoleOverrides(0, payload.roles);
			match.updatePositionOverrides(0, payload.anchors);
		} else {
			match.awayStyle = payload.style;
			match.awayMentality = payload.mentality;
			match.awayFormation = payload.formation;
			match.updateRoleOverrides(1, payload.roles);
			match.updatePositionOverrides(1, payload.anchors);
		}
		sendBuffersAndStatus();
	} else if (type === "SIMULATE_MATCH") {
		if (intervalId) clearTimeout(intervalId);
		const results = match.simulateMatch();
		sendBuffersAndStatus(); // Final sync for replay/final UI
		self.postMessage({
			type: "SIMULATION_COMPLETE",
			homeScore: results.homeScore,
			awayScore: results.awayScore,
			duration: results.duration,
			yellowCards: match.yellowCards,
			redCards: match.redCards,
			subsUsed: match.subsUsed,
			analytics: match.analytics
		});
	} else if (type === "SAVE_REPLAY") {
		if (match.recorder) {
			console.log(`[Worker] Saving replay...`);
			match.recorder.saveToIndexedDB(match.analytics, payload.labels).then(() => {
				console.log(`[Worker] Replay saved.`);
				self.postMessage({ 
					type: "REPLAY_SAVED", 
					payload: { 
						analytics: match.analytics,
						yellowCards: match.yellowCards,
						redCards: match.redCards,
						subsUsed: match.subsUsed
					} 
				});
			}).catch(err => {
				console.error(`[Worker] Save failed:`, err);
				self.postMessage({ 
					type: "REPLAY_SAVED", 
					payload: { 
						analytics: match.analytics,
						yellowCards: match.yellowCards,
						redCards: match.redCards,
						subsUsed: match.subsUsed
					} 
				});
			});
		} else {
			self.postMessage({ 
				type: "REPLAY_SAVED", 
				payload: { 
					analytics: match.analytics,
					yellowCards: match.yellowCards,
					redCards: match.redCards,
					subsUsed: match.subsUsed
				} 
			});
		}
	}
};

function sendStatus() {
	self.postMessage({
		type: "STATUS_UPDATE",
		currentTime: match.currentTime,
		homeScore: match.homeScore,
		awayScore: match.awayScore,
		status: match.status,
		currentHalf: match.currentHalf,
		yellowCards: match.yellowCards,
		redCards: match.redCards,
		subsUsed: match.subsUsed,
		// Only send the latest event if any
		latestEvent: match.analytics.events.length > 0 ? match.analytics.events[match.analytics.events.length - 1] : null,
	});
}

function sendBuffersAndStatus() {
	// Standard postMessage copies the buffers. 
	// Since 252 floats = 1KB, cloning is < 0.01ms. 
	self.postMessage({
		type: "STATE_UPDATE",
		currentTime: match.currentTime,
		homeScore: match.homeScore,
		awayScore: match.awayScore,
		status: match.status,
		currentHalf: match.currentHalf,
		yellowCards: match.yellowCards,
		redCards: match.redCards,
		subsUsed: match.subsUsed,
		playerBuffer: match.memory.playerBuffer,
		ballBuffer: match.memory.ballBuffer,
		// No analytics here to keep it fast
	});
}
