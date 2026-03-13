#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const filePath = process.argv[2] || 'replay-f_vzky7gssf.bin';

if (!fs.existsSync(filePath)) {
    console.error(`Error: File ${filePath} not found.`);
    process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const floats = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

const FLOATS_PER_FRAME = 48;
const frameCount = floats.length / FLOATS_PER_FRAME;

console.log(`\n⚽ MATCH REPLAY REVIEW: ${path.basename(filePath)}`);
console.log(`===================================================`);
console.log(`Total Frames: ${frameCount}`);

if (frameCount === 0) {
    console.log("No data found in replay.");
    process.exit(0);
}

let maxZ = 0;
let totalDist = 0;
let prevBall = null;
let goals = { home: 0, away: 0 };
let wasInGoal = false;

const playerDistances = new Array(22).fill(0);
const prevPlayers = new Array(22).fill(null);

for (let i = 0; i < frameCount; i++) {
    const offset = i * FLOATS_PER_FRAME;
    const time = floats[offset];
    const bx = floats[offset + 1];
    const by = floats[offset + 2];
    const bz = floats[offset + 3];

    // Ball Stats
    maxZ = Math.max(maxZ, bz);
    if (prevBall) {
        totalDist += Math.sqrt((bx - prevBall.x) ** 2 + (by - prevBall.y) ** 2 + (bz - prevBall.z) ** 2);
    }
    prevBall = { x: bx, y: by, z: bz };

    // Simple Goal Detection
    const isGoalZone = by > 30.34 && by < 37.66 && bz < 2.44;
    if (isGoalZone) {
        if (!wasInGoal) {
            if (bx < 0) {
                goals.away++;
                console.log(`[${Math.floor(time/60)}'] ⚽ GOAL for Away Team! (X: ${bx.toFixed(2)})`);
                wasInGoal = true;
            } else if (bx > 105) {
                goals.home++;
                console.log(`[${Math.floor(time/60)}'] ⚽ GOAL for Home Team! (X: ${bx.toFixed(2)})`);
                wasInGoal = true;
            }
        }
    } else {
        wasInGoal = false;
    }

    // Player Stats
    for (let p = 0; p < 22; p++) {
        const px = floats[offset + 4 + p * 2];
        const py = floats[offset + 4 + p * 2 + 1];
        
        if (prevPlayers[p]) {
            playerDistances[p] += Math.sqrt((px - prevPlayers[p].x) ** 2 + (py - prevPlayers[p].y) ** 2);
        }
        prevPlayers[p] = { x: px, y: py };
    }
}

const startTime = floats[0];
const endTime = floats[(frameCount - 1) * FLOATS_PER_FRAME];
const durationMins = (endTime - startTime) / 60;

console.log(`\n📊 PHYSICS & ANALYTICS`);
console.log(`---------------------------------------------------`);
console.log(`Duration:        ${durationMins.toFixed(2)} match minutes`);
console.log(`Final Score:     ${goals.home} - ${goals.away}`);
console.log(`Max Ball Height: ${maxZ.toFixed(2)}m`);
console.log(`Ball Distance:   ${totalDist.toFixed(2)}m`);
console.log(`Avg Ball Speed:  ${(totalDist / (endTime - startTime || 1)).toFixed(2)} m/s`);

console.log(`\n🏃 PLAYER WORKRATE (Top 3)`);
console.log(`---------------------------------------------------`);
const homeWorkrate = playerDistances.slice(0, 11).map((d, i) => ({ id: i + 1, d })).sort((a, b) => b.d - a.d);
const awayWorkrate = playerDistances.slice(11).map((d, i) => ({ id: i + 1, d })).sort((a, b) => b.d - a.d);

console.log(`Home Team: ${homeWorkrate.slice(0, 3).map(p => `Player ${p.id} (${p.d.toFixed(1)}m)`).join(', ')}`);
console.log(`Away Team: ${awayWorkrate.slice(0, 3).map(p => `Player ${p.id} (${p.d.toFixed(1)}m)`).join(', ')}`);

console.log(`\n✅ Review Complete.\n`);
