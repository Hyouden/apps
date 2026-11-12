# App Shelf

A collection of small installable web apps (PWAs) for friends, family and me.
Hosted free on GitHub Pages: every push to `main` goes live in about a minute.

Live URL pattern: `https://<github-username>.github.io/<repo-name>/<app-folder>/`

## Layout

- `index.html` is the shelf page listing every app. Add each new app to its `APPS` list.
- `_template/` is the starting point for a new app. Copy it, never edit it in place.
- One folder per app, e.g. `jennys-garden/`. Folder names are lowercase with hyphens and become part of the URL, so don't rename a folder after someone has installed that app.
- `.nojekyll` stops GitHub Pages from hiding folders that start with `_`. Keep it.

## Adding a new app

1. Copy `_template/` to a new folder named for the app (`my-new-app/`).
2. Replace every `APP NAME`, `SHORT NAME` (12 characters or fewer, shown under the home-screen icon), `APP-SLUG` and `ONE-LINE DESCRIPTION` placeholder in `index.html`, `manifest.webmanifest` and `sw.js`.
3. Build the app in that folder's `index.html`. Keep it self-contained: inline CSS and JS, no build step.
4. Replace the PNGs in `icons/` (192, 512, a 512 maskable with the art in the middle 66%, a 180 apple-touch-icon, and a 64 favicon).
5. Add the app to the `APPS` list in the root `index.html`.
6. Commit and push to `main`.

## Rules every app follows

- **Storage:** all apps share one origin, so they share localStorage. Each app uses its own key prefix (its folder name). Never clear all of localStorage.
- **Service worker:** each app's `sw.js` sits in its own folder so it only controls that folder. Its cache names start with the app's slug, and it only deletes its own old caches.
- **Updating an app:** pages load network-first, so a push shows up next time the person opens the app online. When changing icons or other cached files, bump the version in `CACHE` in that app's `sw.js`.
- **Backups:** apps that keep personal records include a "Back up" / "Restore" button that saves a JSON file, since data lives only on that one phone.
- **Privacy:** this repo and site are public. Don't commit anyone's personal data, addresses, or anything private.
- **Phone-first:** design for a ~390px wide phone with safe-area padding, 44px+ tap targets, and test at that width.

## Quest Log: "add to dungeon" requests

The owner plans goals in chat and asks Claude to "add to dungeon" (or similar). Do that by editing `quest-log/plan.json` and pushing; the app loads it network-first, so no reinstall is needed.

- `dungeons[]`: `{id, name, goal, theme, floors[]}`. `theme` is one of `stone | moss | ice | ember | violet`.
- `floors[]`: `{id, name, sprite, monster, boss?, steps[]}`. `sprite` is one of `slime | bat | goblin | skeleton | ghost | mimic | golem | dragon`. Give the last floor `"boss": true`. Aim for 2 to 5 steps a floor.
- `steps[]`: `{id, t, diff?}`. `diff` is `easy | med | hard | epic` (default `med`).
- `week`: `{start: "YYYY-MM-DD" (Monday), focus: [step ids for this week], side: [{id, t}] one-off tasks}`.
- `history`: past weeks as `{start, focus}`. Before replacing `week`, append the old one here. Progress lives on the phone, so Claude can't see what's done: assume past focus steps are done unless the owner says otherwise.
- **Never change or reuse an existing `id`.** Progress on each phone is stored by step id, so a changed id loses that step's progress. Append new steps and floors with new ids. Removing a step is fine.
- This file is public. Keep steps free of addresses, money amounts, names of other people, employer details and travel dates.
