# The Zero Gravity Web Edition

Explore space in your browser. Multiplayer Beta supports real-time ship and on-foot movement, public servers, and shared exploration across planets and star systems. Single-player mode also supports planetary landings, mining, and crafting.

[Play the game](https://applees-tzg-web-edition.space/) · [Game features and multiplayer guide](https://applees-tzg-web-edition.space/about.html)

## Development

Requires Node.js 22.13+ and pnpm.

```sh
pnpm install
pnpm dev
```

```sh
pnpm build
npm ci --prefix tests
npm test
```

The browser game lives in `public/`. Supabase provides accounts, social features, and saved progress. Database setup is documented in `docs/PLAYER_ACCOUNTS_SETUP.md`.

Created by Applee · Applee Studios. Hosted with Cloudflare & GitHub Pages.
