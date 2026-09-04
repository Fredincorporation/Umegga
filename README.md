# Umegga

Umegga is a persistent, top-down 2D city-state simulator where human choices,
AI agents, stories, and laws shape a shared world. The project combines a
Phaser game canvas with a React interface and Supabase-backed persistence.

## Highlights

- Explore a responsive mythic city with keyboard, touch, and virtual controls.
- Meet autonomous agents with roles, goals, relationships, thoughts, and memory.
- Hold conversations with agents through the local AI chat service.
- Weave stories and enact laws that alter the city's state and atmosphere.
- Inspect chronicles, quests, interventions, world state, and agent memory.
- Expose world actions through the WebMCP model-context tool registry.
- Persist game state, chat, chronicles, laws, events, and audio position in Supabase.

## Technology

- React 18, TypeScript, Vite, and Zustand
- Phaser 3 for the game world and animation lifecycle
- Supabase for persistence, realtime events, and presence
- Tailwind CSS and Lucide React for the interface
- WebMCP for model-driven tools
- Groq-compatible OpenAI chat completions for agent dialogue
- Cloudflare Worker for the standalone agent-chat backend

## Project Layout

```text
public/             Game art, character frames, environment assets, and music
src/components/     React interface panels and controls
src/game/           Phaser scenes, entities, and animation managers
src/services/       AI dialogue, persistence, audio, and WebMCP integrations
src/store/          Zustand game state and domain actions
scripts/            Asset generation, verification, and local service scripts
supabase/           Database migrations
worker/             Cloudflare Worker backend for agent dialogue
```

Character animation frames live at
`public/characters/<character_id>/<animation>/auto-<number>.png` and support
`idle`, `walk`, and `talk` animations. The included characters are Aelira,
Torren, Kaelen, Veyra, Orthas, Sylis, Lira, Elder Maelon, and Vance.

## Requirements

- Node.js 20 or newer
- A Supabase project for persistence
- An AI provider API key for live agent dialogue

## Configuration

Copy `.env.example` to `.env` and provide the Supabase settings. The agent-chat
backend reads `AI_API_KEY`, `AI_API_URL`, and `AI_MODEL`. For local development
these live in `worker/.dev.vars` (gitignored, see `.env.example`); for deployed
Workers, set them as Wrangler secrets with
`npx wrangler secret put AI_API_KEY`. The browser uses `VITE_AGENT_CHAT_ENDPOINT`
to reach the service — in development this is proxied by Vite to the wrangler
dev server on port 3011, and in production it points at your deployed worker
URL (e.g. `https://umegga-agent-chat.<account>.workers.dev/api/agent-chat`).

For Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the
Production environment variables, then redeploy. Apply the SQL migrations to
the same Supabase project before opening the deployed app:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Keep `.env` private. In particular, `AI_API_KEY` must only be read by the
server-side chat process and must never be exposed as a `VITE_` variable.

## Development

```bash
npm install
npm run dev
```

In a second terminal, start the agent-chat Cloudflare Worker locally:

```bash
npm run worker:dev
```

The application runs at `http://localhost:3000` and the Vite development proxy
forwards `/api/agent-chat` to the worker at `http://localhost:3011`.

A legacy Node-based dialogue service (`npm run agent-chat`) is still available
and listens on `http://localhost:3001/api/agent-chat`, but the Cloudflare
Worker is the recommended backend.

## Common Commands

```bash
npm run build                         # Type-check and create a production build
npm run worker:dev                    # Run the agent-chat worker locally
npm run worker:deploy                 # Deploy the agent-chat worker to Cloudflare
node scripts/generate-characters.js  # Generate character sprite frames
node scripts/verify-all.js            # Verify the local server and assets
```

## WebMCP Tools

The application registers tools through `document.modelContext` and the
existing `window.UmeggaMCP` compatibility handle. Available world actions
include `propose_story`, `propose_law`, `query_world_state`, `spawn_agent`,
`move_agent`, `narrate_event`, and `set_weather`.

## Data and Database Notes

Supabase migrations define the existing `Umegga_*` table names. Those names are
kept stable to preserve compatibility with an already-created database. The
browser loads the remote snapshot on startup and debounces state changes back
to Supabase; realtime events are deduplicated before they enter local state.

## Production Considerations

Vercel detects Vite automatically. Use `npm run build` as the build command and
`dist` as the output directory. The `agent-chat` backend is a standalone Cloudflare Worker, deployed with
`npm run worker:deploy`. Set `VITE_AGENT_CHAT_ENDPOINT` to the deployed
worker URL (for example
`https://umegga-agent-chat.<account>.workers.dev/api/agent-chat`) so the
static frontend can reach it.

Before deploying publicly, add authentication and authorization policies to
the Supabase tables, protect the AI endpoint with server-side rate limiting,
and move long-lived world events into dedicated, indexed tables rather than
using the snapshot as the primary event store.
