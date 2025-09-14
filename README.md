# Daily Rack — Highest Scoring Word

You get one Scrabble hand per day. Your goal: make the highest-scoring valid word you can from those 7 letters. Standard Scrabble letter values, plus a 50-point bingo bonus if you use all tiles.

## Run locally

This is a static site (no backend). Open `index.html` in a browser.

If your browser blocks local `fetch` for files, serve the folder:

- Python: `python3 -m http.server 8000`
- Node: `npx http-server -p 8000`

Then visit `http://localhost:8000`.

## Dictionary

- The app tries to load `data/words.txt` (newline-separated, lowercase). If present, word validation is enabled.
- If missing, the game still works but uses a tiny built-in demo list and labels the result as “no dict.”

You can replace `data/words.txt` with any word list (one word per line). Recommended: a Scrabble-legal list or a general English word list. Large lists work, but the optional “best possible” hint iterates the dictionary on the client, so extremely large files may be slow on low-end devices.

## Daily puzzle seed

Everyone gets the same rack per calendar day based on your local date. The rack is sampled from Scrabble tile distribution (no board multipliers; blanks not yet included).

## Files

- `index.html` — markup and layout
- `style.css` — styling
- `app.js` — gameplay logic: rack generation, scoring, validation, persistence, sharing
- `data/words.txt` — sample word list (optional; replace with your own)

## Roadmap / ideas

- Add blank tiles support (wildcards) with better UI.
- Track streaks and personal bests.
- Global seed (UTC) and server-generated daily to ensure same rack worldwide.
- Lightweight server or static JSON for a curated daily rack and dictionary hash.
- Share image (OG or canvas) with rack and score.
- Accessibility: keyboard-only flow and screen reader improvements.

