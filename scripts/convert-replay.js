#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    console.log(`
Usage: node convert-replay.js <input-file.bin> [options]

Options:
  --format <json|base64>   Output format (default: json)
  --output <file>          Output file path (default: stdout)
  --minify                 Minify JSON output
  
Examples:
  node convert-replay.js replay-f_4r2kv5wpe.bin --format json --output replay.json
  node convert-replay.js replay-f_4r2kv5wpe.bin --format base64 --output replay.b64
`);
    process.exit(0);
}

const inputFile = args[0];
if (!fs.existsSync(inputFile)) {
    console.error(`Error: Input file not found: ${inputFile}`);
    process.exit(1);
}

let format = 'json';
let outputFile = null;
let minify = false;

for (let i = 1; i < args.length; i++) {
    if (args[i] === '--format' && args[i + 1]) {
        format = args[++i].toLowerCase();
    } else if (args[i] === '--output' && args[i + 1]) {
        outputFile = args[++i];
    } else if (args[i] === '--minify') {
        minify = true;
    }
}

if (format !== 'json' && format !== 'base64') {
    console.error(`Error: Unsupported format '${format}'. Use 'json' or 'base64'.`);
    process.exit(1);
}

try {
    const buffer = fs.readFileSync(inputFile);
    
    if (format === 'base64') {
        const base64Str = buffer.toString('base64');
        if (outputFile) {
            fs.writeFileSync(outputFile, base64Str);
            console.log(`Successfully wrote Base64 to ${outputFile}`);
        } else {
            console.log(base64Str);
        }
    } else if (format === 'json') {
        const floatView = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
        const FLOATS_PER_FRAME = 48;
        const numFrames = Math.floor(floatView.length / FLOATS_PER_FRAME);
        
        const frames = [];
        
        for (let i = 0; i < numFrames; i++) {
            const off = i * FLOATS_PER_FRAME;
            const frameData = {
                time: floatView[off],
                ball: {
                    x: floatView[off + 1],
                    y: floatView[off + 2],
                    z: floatView[off + 3]
                },
                players: []
            };
            
            for (let p = 0; p < 22; p++) {
                frameData.players.push({
                    id: p,
                    x: floatView[off + 4 + p * 2],
                    y: floatView[off + 5 + p * 2]
                });
            }
            
            frames.push(frameData);
        }
        
        const jsonData = {
            metadata: {
                frameCount: numFrames,
                fps: 10, // Assuming standard 10fps capture
                source: path.basename(inputFile)
            },
            frames: frames
        };
        
        const jsonStr = minify ? JSON.stringify(jsonData) : JSON.stringify(jsonData, null, 2);
        
        if (outputFile) {
            fs.writeFileSync(outputFile, jsonStr);
            console.log(`Successfully wrote JSON to ${outputFile}`);
        } else {
            console.log(jsonStr);
        }
    }
} catch (e) {
    console.error(`Error converting file: ${e.message}`);
    process.exit(1);
}
