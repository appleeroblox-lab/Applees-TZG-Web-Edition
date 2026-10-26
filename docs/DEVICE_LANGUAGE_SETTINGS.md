# Device preferences and offline languages (v84)
System Language and Chat Translation Language are independent, device-saved choices: English, Burmese, French, Japanese and Thai. Game-styled selectors replace native dropdowns. UI dictionaries ship with the game; the game title and player content remain unchanged. Missing UI entries fall back to English.

Show Chat Translation Button enables a manual Translate action in message options for global, friend and group messages. No automatic translation or translation API remains. A curated phrasebook translates recognized phrases only; unknown messages retain their originals and show an unavailable notice. Burmese bro is ဟျောင့်. Original message/report/edit data stays intact.

Inbox ordering uses authorized latest-message IDs with a deterministic room-ID tie break before drawing. Preview requests update text without moving rows. Buttons wrap growing text and navigation rows have gaps.

No SQL migration is required. Device preference and social regression suites pass; browser fixtures cover desktop and landscape mobile sizes.
