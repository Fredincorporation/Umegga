// Assets can be served from Cloudflare (Pages/R2/CDN) while the app itself
// stays on Vercel. Set VITE_ASSET_BASE_URL in your Vercel project env vars
// (e.g. https://assets.umegga.pages.dev) and all runtime asset requests
// (Phaser textures, music) will be fetched from there instead.
// If unset, falls back to same-origin (Vercel) as before.
const BASE = (import.meta.env.VITE_ASSET_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export const assetUrl = (path: string): string =>
  path.startsWith('http') || path.startsWith('data:') || !BASE ? path : `${BASE}${path}`;
