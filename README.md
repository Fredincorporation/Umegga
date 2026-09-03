# Umega – Mythic City-State Agent Society Simulator

A persistent top-down 2D multiplayer web game where stories and laws literally shape reality. Humans and AI agents coexist in the same world.

## Tech Stack
- **React 18 + Vite + TypeScript**: Modular, responsive single-page web app.
- **Phaser 3**: High performance top-down 2D game engine.
- **Zustand**: Reactive state management syncing React UI and Phaser scene lifecycle.
- **Supabase**: Realtime multiplayer broadcast and presence mesh.
- **Tailwind CSS & Lucide React**: Fantasy-themed HUD, Chronicle Modals, and Agent Inspector.
- **WebMCP**: Native `document.modelContext.registerTool` protocol for LLM agents.

---

## Character Frame System
Individual frame PNGs located in `public/characters/<character_id>/<anim_type>/auto-<001..00X>.png`:
- **Aelira the Storyweaver** (`aelira`)
- **Torren Justicar** (`torren`)
- **Kaelen Forgeheart** (`kaelen`)
- **Veyra Voidseeker** (`veyra`)
- **Orthas Stonecarver** (`orthas`)
- **Sylis Verdant** (`sylis`)
- **Lira Nightgale** (`lira`)
- **Elder Maelon** (`elder_maelon`)
- **Vance Goldspire** (`vance`)

Supported animations:
- `idle`: 6-frame smooth breathing & hovering loop
- `walk`: 6-frame kinetic stride & arm swing cycle
- `talk`: 4-frame interactive dialogue expression

---

## Key Features Implemented

### 1. Embedded Phaser 3 Engine in React
- Full-screen responsive canvas with auto-resize.
- `AnimationManager` preloads all frame textures and creates animation keys (`aelira_idle`, `aelira_walk`, etc.).
- Smooth camera follow with zoom control (mouse wheel & responsive bounding).

### 2. Player Controls & Law Modifiers
- **WASD** and **Arrow Key** movement.
- Virtual D-pad for mobile and touch devices.
- Dynamic movement velocity directly modified in real-time by active city laws (e.g., *Edict of Fleet Stride*).

### 3. AI Agent Society
- Autonomous AI state machine: wandering, idling, thought bubbles, and episodic memory.
- Clicking on an agent opens the **Agent Inspector** panel with lore, cognitive state, affinity, and episodic memory ledger.
- Inscribe thoughts directly into agent minds.

### 4. Story & Law Proposal System (Reality Reshaping)
- **Weave Story**: Inscribe mythic chronicles that trigger visual phenomena (aurora, flame ward, celestial eclipse) and modify world distortion.
- **Enact Law**: Ratify binding decrees (movement speed multiplier, mana regeneration rate, radiant glow).
- **Chronicles Ledger**: Historical browser of all ratified laws and enacted stories with resonance scores.

### 5. WebMCP (Model Context Protocol) Integration
Exposes tools on `document.modelContext` and `window.umegaMCP`:
- `propose_story`
- `propose_law`
- `query_world_state`
- `spawn_agent`
- `move_agent`
- `narrate_event`
- `set_weather`
- Includes an interactive in-game **WebMCP Console** to test tool invocations and view live execution streams.

---

## Running the Project

```bash
# Install dependencies
npm install

# Generate / regenerate character sprite frames
node scripts/generate-characters.js

# Start local dev server
npm run dev

# Build for production
npm run build
```
