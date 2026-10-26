# GIF loading repair (v91)

The default picker now serves 24 original animated TZG reaction GIFs from the same GitHub Pages host as the game. No external API or Cloudflare host is required to browse, preview, select, or send these GIFs.

An optional Online GIFs button retains the remote provider, with a five second timeout and local fallback when unavailable. Existing upload size, animation checks and media reporting remain in place. No database migration is required.

The assets are original programmatic drawings; scripts/generate-reaction-gifs.py regenerates them with Pillow. They total under 400 KB.
