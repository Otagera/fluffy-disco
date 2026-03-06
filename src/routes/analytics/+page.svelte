<script lang="ts">
  import type { PageData } from './$types';
  import { PITCH_W, PITCH_H } from '$lib/game/constants';

  let { data }: { data: PageData } = $props();

  let activeTab = $state<'passes' | 'shots' | 'heatmap'>('passes');
  let selectedTeam = $state<'home' | 'away'>('home');

  // Passing Network Logic
  // Aggregate passes to find strong connections and average positions
  const getPassingNetwork = (team: 'home' | 'away') => {
    if (!data.hasAnalytics || !data.analytics) return { nodes: [], links: [] };
    
    const passes = data.analytics.passes.filter(p => p.team === team);
    
    const nodePositions: Record<string, { x: number, y: number, count: number, name: string }> = {};
    const linkCounts: Record<string, number> = {};

    passes.forEach(p => {
      // Record start position for 'from' node
      if (!nodePositions[p.fromId]) nodePositions[p.fromId] = { x: 0, y: 0, count: 0, name: p.fromName };
      nodePositions[p.fromId].x += p.startX;
      nodePositions[p.fromId].y += p.startY;
      nodePositions[p.fromId].count++;

      // Record end position for 'to' node (less accurate than start, but helps anchor receivers)
      if (!nodePositions[p.toId]) nodePositions[p.toId] = { x: 0, y: 0, count: 0, name: p.toName };
      nodePositions[p.toId].x += p.endX;
      nodePositions[p.toId].y += p.endY;
      nodePositions[p.toId].count++;

      // Record link
      const linkKey = [p.fromId, p.toId].sort().join('-');
      linkCounts[linkKey] = (linkCounts[linkKey] || 0) + 1;
    });

    const nodes = Object.entries(nodePositions)
      .filter(([id]) => id !== 'unknown') // Don't draw a giant 'Teammate' node
      .map(([id, pos]) => ({
        id,
        name: pos.name,
        x: pos.x / pos.count,
        y: pos.y / pos.count,
        radius: Math.min(10, 2 + (pos.count * 0.1)) // Size node by involvement
      }));

    const maxLinkCount = Math.max(1, ...Object.values(linkCounts));
    
    const links = Object.entries(linkCounts).map(([key, count]) => {
      const [id1, id2] = key.split('-');
      const n1 = nodes.find(n => n.id === id1);
      const n2 = nodes.find(n => n.id === id2);
      if (!n1 || !n2) return null;
      return {
        x1: n1.x, y1: n1.y,
        x2: n2.x, y2: n2.y,
        weight: (count / maxLinkCount) * 5 // Max thickness of 5
      };
    }).filter(Boolean) as {x1: number, y1: number, x2: number, y2: number, weight: number}[];

    return { nodes, links };
  };

  // Heatmap Logic
  const getHeatmapBins = (team: 'home' | 'away') => {
    if (!data.hasAnalytics || !data.analytics) return [];
    
    const samples = data.analytics.heatmapSamples.filter(s => s.team === team);
    const cols = 21; // 5m bins
    const rows = 14; // ~5m bins
    
    const bins = Array(cols * rows).fill(0);
    let maxBin = 0;

    samples.forEach(s => {
      const c = Math.min(cols - 1, Math.floor(s.x * cols));
      const r = Math.min(rows - 1, Math.floor(s.y * rows));
      const idx = r * cols + c;
      bins[idx]++;
      if (bins[idx] > maxBin) maxBin = bins[idx];
    });

    return bins.map((count, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      return {
        x: (c / cols) * PITCH_W,
        y: (r / rows) * PITCH_H,
        w: PITCH_W / cols,
        h: PITCH_H / rows,
        opacity: maxBin === 0 ? 0 : Math.min(0.8, count / (maxBin * 0.8)) // Soft cap so very hot areas are solid
      };
    });
  };

  let passingNetwork = $derived(getPassingNetwork(selectedTeam));
  let heatmapBins = $derived(getHeatmapBins(selectedTeam));
  let teamShots = $derived(data.hasAnalytics && data.analytics ? data.analytics.shots.filter(s => s.team === selectedTeam) : []);
</script>

<div class="container">
  <div class="header">
    <h1>Post-Match Analytics</h1>
    <button class="dashboard-btn" onclick={() => window.location.href = '/'}>Back to Dashboard</button>
  </div>

  {#if !data.hasAnalytics}
    <div class="card empty-state">
      <h2>No Analytics Data Available</h2>
      <p>Play or simulate a match to generate analytics data.</p>
    </div>
  {:else}
    <div class="controls">
      <div class="team-toggles">
        <button class:active={selectedTeam === 'home'} onclick={() => selectedTeam = 'home'}>Home Team</button>
        <button class:active={selectedTeam === 'away'} onclick={() => selectedTeam = 'away'}>Away Team</button>
      </div>
      <div class="tab-toggles">
        <button class:active={activeTab === 'passes'} onclick={() => activeTab = 'passes'}>Passing Network</button>
        <button class:active={activeTab === 'shots'} onclick={() => activeTab = 'shots'}>Shot Map</button>
        <button class:active={activeTab === 'heatmap'} onclick={() => activeTab = 'heatmap'}>Heatmap</button>
      </div>
    </div>

    <div class="viz-container card">
      <svg viewBox="0 0 {PITCH_W} {PITCH_H}" class="pitch-svg">
        <!-- Pitch Background -->
        <rect width={PITCH_W} height={PITCH_H} fill="#2d8a4a" />
        <rect width={PITCH_W} height={PITCH_H} fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
        <line x1={PITCH_W/2} y1="0" x2={PITCH_W/2} y2={PITCH_H} stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
        <circle cx={PITCH_W/2} cy={PITCH_H/2} r="9.15" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
        <rect x="0" y={PITCH_H/2 - 20.16} width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />
        <rect x={PITCH_W - 16.5} y={PITCH_H/2 - 20.16} width="16.5" height="40.32" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.5" />

        {#if activeTab === 'heatmap'}
          {#each heatmapBins as bin}
            {#if bin.opacity > 0}
              <!-- Heatmap gradient overlay (Red = Hot, Yellow = Warm) -->
              <rect 
                x={bin.x} y={bin.y} width={bin.w + 0.2} height={bin.h + 0.2} 
                fill={bin.opacity > 0.5 ? '#f44336' : '#ffeb3b'} 
                opacity={bin.opacity} 
              />
            {/if}
          {/each}
        {/if}

        {#if activeTab === 'passes'}
          {#each passingNetwork.links as link}
            <!-- Pass Links -->
            <line 
              x1={link.x1 * PITCH_W} y1={link.y1 * PITCH_H} 
              x2={link.x2 * PITCH_W} y2={link.y2 * PITCH_H} 
              stroke="rgba(255, 255, 255, {Math.max(0.1, link.weight / 5)})" 
              stroke-width={link.weight} 
            />
          {/each}

          {#each passingNetwork.nodes as node}
            <!-- Player Nodes -->
            <circle 
              cx={node.x * PITCH_W} cy={node.y * PITCH_H} 
              r={node.radius} 
              fill={selectedTeam === 'home' ? '#1a5f2a' : '#dc3545'} 
              stroke="white" 
              stroke-width="1" 
            />
            <text 
              x={node.x * PITCH_W} y={(node.y * PITCH_H) + node.radius + 3} 
              font-size="2" text-anchor="middle" fill="white" font-weight="bold"
              style="text-shadow: 0 1px 2px black;"
            >
              {node.name.split(' ')[1] || node.name}
            </text>
          {/each}
        {/if}

        {#if activeTab === 'shots'}
          {#each teamShots as shot}
            <!-- Shot Bubbles -->
            <circle 
              cx={shot.x * PITCH_W} cy={shot.y * PITCH_H} 
              r={1 + (shot.xg * 8)} 
              fill={shot.result === 'GOAL' ? '#4caf50' : shot.result === 'SAVE' ? '#ff9800' : '#f44336'} 
              stroke="white" 
              stroke-width="0.5" 
              opacity="0.8"
            />
          {/each}
          
          <!-- Attacking direction indicator -->
          <text x={selectedTeam === 'home' ? PITCH_W / 4 : PITCH_W * 0.75} y="10" font-size="4" fill="rgba(255,255,255,0.4)" font-weight="bold">
            ATTACKING ➔
          </text>
        {/if}
      </svg>
    </div>

    <!-- Analytics Legend/Summary -->
    <div class="card legend">
      {#if activeTab === 'passes'}
        <h3>Passing Network</h3>
        <p>Thicker lines indicate more frequent passes between players. Larger nodes indicate players who were highly involved in possession.</p>
      {:else if activeTab === 'shots'}
        <h3>Shot Map</h3>
        <p>Circle size represents the <strong>Expected Goals (xG)</strong> value of the shot. Larger circles = better scoring opportunities.</p>
        <div class="flex gap-1 mt-1">
          <span style="color: #4caf50; font-weight: bold;">● Goal</span>
          <span style="color: #ff9800; font-weight: bold;">● Saved</span>
          <span style="color: #f44336; font-weight: bold;">● Missed/Blocked</span>
        </div>
      {:else if activeTab === 'heatmap'}
        <h3>Heatmap</h3>
        <p>Shows the spatial density of the team's movements throughout the match. Red areas indicate high concentration and activity.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .container { max-width: 1000px; margin: 0 auto; padding: 2rem 1rem; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
  .header h1 { margin: 0; color: white; }
  
  .dashboard-btn {
    background: #333; color: white; border: 1px solid #555; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-weight: bold;
  }
  .dashboard-btn:hover { background: #444; }

  .empty-state { text-align: center; padding: 4rem; color: #888; }
  
  .controls { display: flex; justify-content: space-between; margin-bottom: 1rem; }
  .team-toggles, .tab-toggles { display: flex; gap: 0.5rem; }
  
  button {
    background: #222; color: #888; border: 1px solid #333; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: bold; transition: all 0.2s;
  }
  button:hover { background: #333; }
  button.active { background: var(--primary); color: white; border-color: var(--primary); }

  .viz-container { padding: 1rem; background: #111; border: 1px solid #222; }
  .pitch-svg { width: 100%; aspect-ratio: 105/68; border-radius: 4px; overflow: hidden; }

  .legend { margin-top: 1rem; background: #1a1a1a; padding: 1.5rem; border-radius: 8px; border: 1px solid #222; color: #ccc; }
  .legend h3 { margin-top: 0; margin-bottom: 0.5rem; color: white; }
  .legend p { margin: 0; font-size: 0.9rem; line-height: 1.4; }
  
  .flex { display: flex; }
  .gap-1 { gap: 1rem; }
  .mt-1 { margin-top: 1rem; }
</style>
