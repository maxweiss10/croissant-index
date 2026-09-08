# 🥐 SF Croissant Index

A blind-tasting scorecard for San Francisco croissants. Score five criteria out of
ten, get one number out of 100, and settle the group-chat argument with data
instead of vibes.

No build step, no backend, no accounts, no paywall — three static files that run
straight from the filesystem or GitHub Pages.

## Use it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

To publish it: push this repo and turn on GitHub Pages (Settings → Pages → deploy
from branch, root folder).

## How scoring works

Every tasting rates five criteria from 1 to 10:

| Criterion | What you're judging |
|---|---|
| **Lamination** | Distinct layers, open honeycomb |
| **Crust** | Shatter, crackle, shard count |
| **Crumb** | Chewy and cooked through, never doughy |
| **Butter** | Depth of flavor, cultured tang |
| **Balance** | Bake, salt, size, finish |

The 50 raw points are doubled into a **combined score out of 100**. A bakery's
rank is the mean of its tastings, so the more of the group that logs a visit, the
less one bad Tuesday morning distorts the standings.

Price is recorded per tasting, which gives the two things the standings can't show
on their own:

- **Points per dollar** — the value column, and the answer to "is the $8 one
  actually better?"
- **Price vs. score** — a scatter plot of every tasted bakery, with bubble size
  showing how many tastings back each point.

## What's in the app

- **Rankings** — sort by score, value, price, or number of tastings; open any card
  for its per-criterion averages and every individual tasting with notes. Filter
  the whole view down to one taster to see a single palate's list.
- **Log a tasting** — pick a bakery or add a new one, set the price, drag five
  sliders, watch the combined score update live.
- **Price vs. score** — the scatter plot, with hover details, a table view, and
  full light/dark support.
- **Data** — export/import JSON, and a "copy rankings for the group chat" button
  that formats the standings as plain text.

## Data and privacy

Everything is stored in your browser's `localStorage` under
`sf-croissant-index/v1` — nothing is uploaded anywhere. To combine the group's
tastings, one person exports the JSON, everyone else imports it: the merge matches
bakeries by name and tastings by id, so importing the same file twice is safe and
never duplicates a row.

The bakery list ships pre-seeded with ten well-known SF croissant spots as a
starting lineup. **No scores are seeded** — every number in the app comes from a
tasting someone in your group logged.

## Files

```
index.html   markup and copy
styles.css   design tokens, light and dark themes
app.js       state, storage, rankings, chart — vanilla JS, zero dependencies
```

Charts are hand-rolled inline SVG; the single-series blue is validated for
contrast against both the light and dark chart surfaces.
