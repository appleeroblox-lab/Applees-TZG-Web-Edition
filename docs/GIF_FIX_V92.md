# GIF loading repair (v92)

The 24 original game reactions now carry their GIF bytes in a bundled module. The picker previews them as data URLs and creates the selected attachment directly from those bytes. Neither step fetches a GIF image URL. This preserves the existing animated GIF payload and upload validation used by global and party chat.

The optional online provider remains available. Empty search results return matching game reactions; failed online downloads or completely failed preview batches return to game reactions with an explanation. A failed selection never silently attaches a different reaction. The import chain leading to the picker uses v92 URLs to avoid cached v91 loader code. No SQL changes are needed.

Regenerate the original images and embedded payload with `python scripts/generate-reaction-gifs.py`. Validate with `npm run test:gifs` and `node tests/social-world-v90.mjs`. The GIF tests cover blocked fetches, byte-for-byte attachment equality, chat payload validation, empty online results, preview/download failures and subsequent successful local selection. Physical-device network behavior remains unverified.
