import { MatchStatus } from "./Match.svelte.ts";
import { MatchMemory } from "./core/MatchMemory";

/**
 * MatchController runs on the main thread.
 * It manages the Svelte reactivity and proxies commands to the Web Worker
 * where the actual MatchEngine runs.
 */
export class MatchController {
	public memory: MatchMemory;
	
	// Svelte 5 Reactive State
	public homeScore: number = $state(0);
	public awayScore: number = $state(0);
	public status: MatchStatus = $state(MatchStatus.KICKOFF);
	public currentHalf: number = $state(1);
	public currentTime: number = $state(0);
	
	// Card & Sub Tracking
	public yellowCards: number[] = $state(new Array(22).fill(0));
	public redCards: number[] = $state(new Array(22).fill(0));
	public subsUsed: [number, number] = $state([0, 0]);
	
	public worker: Worker | null = null;
	public recorder: any = null; // Stays on main thread? Or we can just let UI handle it
	public analytics: any = { events: [], heatmapSamples: [], passes: [], shots: [] };

	constructor() {
		this.memory = new MatchMemory();

		if (typeof window !== "undefined") {
			// Initialize Worker
			this.worker = new Worker(new URL("./worker/match.worker.ts", import.meta.url), { type: "module" });
			
			this.worker.onmessage = (e) => {
				const { type, ...payload } = e.data;

				if (type === "STATE_UPDATE" || type === "STATUS_UPDATE") {
					this.currentTime = payload.currentTime;
					this.homeScore = payload.homeScore;
					this.awayScore = payload.awayScore;
					this.status = payload.status;
					this.currentHalf = payload.currentHalf;

					if (payload.yellowCards) this.yellowCards = payload.yellowCards;
					if (payload.redCards) this.redCards = payload.redCards;
					if (payload.subsUsed) this.subsUsed = payload.subsUsed;

					if (payload.playerBuffer && payload.ballBuffer) {
						this.memory.playerBuffer.set(payload.playerBuffer);
						this.memory.ballBuffer.set(payload.ballBuffer);

						// If we have a recorder on the main thread, capture frame here
						if (this.recorder) {
							this.recorder.captureFrame(this.memory, this.currentTime);
						}
					}
					
					if (payload.latestEvent) {
						const last = this.analytics.events[this.analytics.events.length - 1];
						// Simple deduplication based on type and time
						if (!last || last.time !== payload.latestEvent.time || last.type !== payload.latestEvent.type) {
							this.analytics.events.push(payload.latestEvent);
						}
					}
				} else if (type === "SIMULATION_COMPLETE") {
					this.currentTime = payload.duration;
					this.homeScore = payload.homeScore;
					this.awayScore = payload.awayScore;
					if (payload.yellowCards) this.yellowCards = payload.yellowCards;
					if (payload.redCards) this.redCards = payload.redCards;
					if (payload.subsUsed) this.subsUsed = payload.subsUsed;
					if (payload.analytics) {
						this.analytics = payload.analytics;
					}
					if (this.simulateResolve) {
						this.simulateResolve(payload);
						this.simulateResolve = null;
					}
				} else if (type === "REPLAY_SAVED") {
					if (payload.analytics) {
						this.analytics = payload.analytics;
					}
					if (payload.yellowCards) this.yellowCards = payload.yellowCards;
					if (payload.redCards) this.redCards = payload.redCards;
					if (payload.subsUsed) this.subsUsed = payload.subsUsed;
					if (this.saveResolve) {
						this.saveResolve();
						this.saveResolve = null;
					}
				} else if (type === "ERROR") {
					console.error("Engine Worker Error:", payload.message, payload.stack);
				}
			};
		}
	}

	public setup(
		initialAnchors: { x: number; y: number }[],
		playerStats: any[],
		starterRoles: string[],
		tacticalStyles?: [string, string],
		mentalities?: [string, string],
		formationNames?: [string, string],
		isKickoff: boolean = true,
		matchId?: string,
		homeTeamId?: string,
		awayTeamId?: string,
		managedTeam: number | null = null
	) {
		// Just proxy to worker
		if (this.worker) {
			this.worker.postMessage({
				type: "INIT",
				payload: $state.snapshot({
					anchors: initialAnchors,
					stats: playerStats,
					roles: starterRoles,
					styles: tacticalStyles,
					mentalities: mentalities,
					formations: formationNames,
					isKickoff: isKickoff,
					managedTeam,
					matchId,
					homeTeamId,
					awayTeamId
				})
			});
		}
	}

	public setSpeed(speed: number) {
		if (this.worker) {
			this.worker.postMessage({
				type: "SET_SPEED",
				payload: { speed }
			});
		}
	}

	public start() {
		if (this.worker) this.worker.postMessage({ type: "START", payload: {} });
	}

	public pause() {
		if (this.worker) this.worker.postMessage({ type: "PAUSE", payload: {} });
	}

	public setBenchStats(team: number, stats: any[]) {
		if (this.worker) this.worker.postMessage({ type: "SET_BENCH", payload: $state.snapshot({ team, stats }) });
	}

	public setBenchRoles(team: number, roles: string[]) {
		if (this.worker) this.worker.postMessage({ type: "SET_BENCH_ROLES", payload: $state.snapshot({ team, roles }) });
	}

	public makeSub(team: number, outIdx: number, benchIdx: number): boolean {
		// We assume it always succeeds optimistically to update UI, worker will validate
		if (this.worker) {
			this.worker.postMessage({
				type: "MAKE_SUB",
				payload: { team, outIdx, benchIdx }
			});
		}
		return true; // Optimistic return for UI
	}

	public swapPlayers(team: number, idx1: number, idx2: number) {
		if (this.worker) {
			this.worker.postMessage({
				type: "SWAP_PLAYERS",
				payload: { team, idx1, idx2 }
			});
		}
	}

	private simulateResolve: ((res: any) => void) | null = null;
	private saveResolve: (() => void) | null = null;

	public async simulateMatch(): Promise<{ homeScore: number; awayScore: number; duration: number }> {
		return new Promise((resolve) => {
			this.simulateResolve = resolve;
			if (this.worker) {
				this.worker.postMessage({ type: "SIMULATE_MATCH", payload: {} });
			}
		});
	}

	public startSecondHalf(anchors: any[], stats: any[], roles: any[], styles: any, mentalities: any, formations: any) {
		if (this.worker) {
			this.worker.postMessage({
				type: "START_SECOND_HALF",
				payload: $state.snapshot({ anchors, stats, roles, styles, mentalities, formations })
			});
		}
	}

	public updateTactics(isHome: boolean, roles: any, style: string, mentality: string, formation: string, anchors: any) {
		if (this.worker) {
			// Convert normalized anchors to meters before sending to worker
			const convertedAnchors: Record<number, { x: number; y: number }> = {};
			for (const [idx, pos] of Object.entries(anchors)) {
				const p = pos as { x: number; y: number };
				if (isHome) {
					convertedAnchors[Number(idx)] = { x: p.x * 105, y: p.y * 68 };
				} else {
					convertedAnchors[Number(idx)] = { x: (1 - p.x) * 105, y: (1 - p.y) * 68 };
				}
			}

			this.worker.postMessage({
				type: "TACTICS_UPDATE",
				payload: $state.snapshot({ isHome, roles, style, mentality, formation, anchors: convertedAnchors })
			});
		}
	}

	public async saveReplay(labels: string[]): Promise<void> {
		return new Promise((resolve) => {
			this.saveResolve = resolve;
			if (this.worker) {
				this.worker.postMessage({
					type: "SAVE_REPLAY",
					payload: $state.snapshot({ labels })
				});
			} else {
				resolve();
			}
		});
	}
	public terminate() {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}
	}
}
