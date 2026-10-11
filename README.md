# Main Stats

Ezekiel's YouTube and Instagram dashboard as a plain static site.

- `index.html` is the page. It reads `data.json` and draws everything in the browser.
- `d3.min.js` is the chart library (D3 7.9.0), kept here so the site needs nothing from outside.
- `data.json` holds the numbers. A daily Claude task rebuilds it and pushes it here.
- `scripts/build.mjs` turns the day's Windsor.ai pulls (saved in `raw/`, not committed) into `data.json`.

## How the daily refresh works

1. Pull eight reports from Windsor.ai (Instagram and YouTube) into `raw/`. The eighth is the Instagram comments.
2. Run `node scripts/build.mjs --comments` to see which comments have no theme yet, and write their themes to `raw/ig_themes.json`.
3. Run `node scripts/build.mjs`.
4. Commit `data.json` and push to this branch. Netlify redeploys on the push.

The build keeps history. Each run saves that day's real follower and subscriber counts,
so the totals stop being estimates from the first run onward, and days older than
Windsor's 30-day window stay in the file.

## Comments

The Comments section shows what people wrote on the Instagram posts of the last 30 days, three ways:
Most said (grouped by theme, biggest group first), Popular (most liked first) and Not replied.

- Windsor.ai only names the author on the account's own comments. That is how the build knows which
  comments have a reply from the account and which are still waiting.
- A comment's theme is chosen by the daily task, which reads the new comments and files each one under
  an existing theme or a new one. Themes are saved in `data.json`, so only new comments need sorting.
- Comments drop off once their post is older than 30 days. GIF-only comments are left out.
- YouTube comments are not included: Windsor.ai doesn't provide them.

## The 1D view

1D shows the latest day each platform has finished counting, next to the day before and the 7-day average.
Instagram's newest day is still running when the daily pull happens, so 1D uses the day before it.
YouTube reports 2 to 3 days late, so its latest full day is older.

This branch is separate from the rest of the repo on purpose: it shares no files or history with `master`.
