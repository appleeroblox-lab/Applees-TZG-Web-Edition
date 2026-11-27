# Experimental multiplayer

The existing game stays on GitHub Pages. The beta Worker contains authentication, room coordination and signaling. Its SQLite Durable Object owns the bounded two-room directory so capacity and host election are serialized. Direct WebRTC Data Channels carry pose data between clients in the same location and within range. When a direct channel is unavailable, the Worker relays nearby player snapshots at up to one update per second with a daily quota reserve for lobby operations. A peer controls its own rendered actor. Supabase remains responsible for accounts, purchases, inventory, and progress.

## Free-plan deployment

1. Verify the Cloudflare account is on Workers Free before uploading the Worker. No subscription change is required. Do not provision TURN.
2. Upload `worker.mjs` and `deployment.json` as module and metadata using the Cloudflare Workers upload API. Append `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY` and `ALLOWED_ORIGINS` as plain text bindings. Supply the game's exact trusted Pages/preview origins. On later uploads, use the existing migration tag.
3. The beta accepts signed-in Supabase accounts. Guest and anonymous sessions are excluded.
4. Enable `BETA_ENABLED` for the public experiment. Verify `/health`, rejection of unauthenticated requests, and signed-in access.
5. Start with two users on Earth. Test group changes, boarding, warp, host suspension, reconnection and leave. Repeat on physical Android, iOS, tablet and desktop browsers before raising capacity. Restrictions on UDP and restrictive NAT can block direct connections. Players can still join the global room, and nearby players receive lower-rate movement updates through the Worker where relay capacity is available.

The Worker uses a 35,000-event daily application cap for the coordinating object. The Developer Panel shows the counted events, per-peer latency and pose bytes per second. Account-level Worker requests, storage and duration still need to be checked in Cloudflare analytics. Session settings are 60 minutes, two rooms and five seats per room. Keep the Worker beta flag off when testing is paused for long periods.

Run `node tests/multiplayer.mjs` for authorization, capacity, expiration, isolation, signaling, host migration and packet validation tests. These simulations do not establish a real ICE connection or measure hardware performance.
