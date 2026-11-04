# The Zero Gravity – Web

Explore space, fly between worlds, land, mine resources, and play with friends.

[Play the game](https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html)

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

Created by Applee · Meowple Studios. Hosted with Cloudflare & GitHub Pages.
