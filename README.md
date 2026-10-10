# Main Stats

Ezekiel's YouTube and Instagram dashboard as a plain static site.

- `index.html` is the page. It reads `data.json` and draws everything in the browser.
- `d3.min.js` is the chart library (D3 7.9.0), kept here so the site needs nothing from outside.
- `data.json` holds the numbers. A daily Claude task rebuilds it and pushes it here.
- `scripts/build.mjs` turns the day's Windsor.ai pulls (saved in `raw/`, not committed) into `data.json`.

## How the daily refresh works

1. Pull seven small reports from Windsor.ai (Instagram and YouTube) into `raw/`.
2. Run `node scripts/build.mjs`.
3. Commit `data.json` and push to this branch. Netlify redeploys on the push.

The build keeps history. Each run saves that day's real follower and subscriber counts,
so the totals stop being estimates from the first run onward, and days older than
Windsor's 30-day window stay in the file.

This branch is separate from the rest of the repo on purpose: it shares no files or history with `master`.
