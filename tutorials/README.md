# Tutorials

Animated how-to pages, published on the website at **`/tutorials/`** (for example `https://cem.deba.indevs.in/tutorials/`).

They are **not part of the app**. This folder is outside `www/`, and the Android build only packs `www/`, so nothing here ends up in the APK. The app links to the page from the profile menu (**Tutorials**), which opens it in a new browser tab (in the Android app: the phone's browser).

## Add a new tutorial

1. Upload your tutorial `.html` file into this `tutorials/` folder (GitHub: **Add file > Upload files**).
2. Commit to `main`, then run **Actions > Deploy web version > Run workflow**. The tutorials page gets a new button once it finishes. Nothing is published until you run it.

That is all. The button text is the page's `<title>`; everything after a ` | ` is dropped, so
`<title>How to sign in | Campus Events tutorial</title>` shows as **How to sign in**.
The page lives at `/tutorials/<file name>`, e.g. `signin&signup.html` -> `/tutorials/signin&signup.html`.

Tip: use file names with letters, numbers and hyphens (`take-payments.html`). Spaces and symbols such as `&` work but make for awkward links.

## Optional extras (all inside the tutorial's `<head>`)

```html
<meta name="description" content="One line shown under the title on the button.">
<meta name="keywords" content="extra, words, the search bar should match">
<meta name="tutorial-order" content="2">   <!-- lower numbers come first; without it, tutorials are sorted A to Z -->
```

## Shared library (`shared/`)

Everything the tutorials have in common lives once in `shared/`, so each tutorial file only holds its own steps and text:

- `shared/tutorial.css`: page, phone frame, controls and form look. Fonts load from the app's `/fonts/` folder (cached, not embedded).
- `shared/tutorial.js`: the player (cursor, taps, typing, sound, step list, Back / Next / Restart).

A new tutorial links both files and adds only what is different:

```html
<link rel="preload" href="../fonts/bricolage-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="../fonts/figtree-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="shared/tutorial.css">
<style>/* only this tutorial's extra CSS */</style>
...
<script src="shared/tutorial.js"></script>
<script>/* variables for this tutorial, its steps (TA / TB), then: */
addEventListener('resize',fit);fit();mount('A');play(0);</script>
```

Copy `create-event.html` or `signin&signup.html` as a starting point. Change `shared/` once and every tutorial updates.

## Rules

- Each tutorial is one `.html` file that uses `shared/` for the common parts (see above). It may also use a sub-folder such as `assets/`.
- The search bar on the tutorials page matches the title, description and `keywords` meta of each tutorial. It appears once there are two or more.
- A file or folder whose name starts with `_` or `.` is never published or listed. Name a work-in-progress `_take-payments.html`, then rename it when it is ready.
- `index.html` here is the template of the tutorials page. Leave its two `<!--TUTORIAL_...-->` placeholders alone.
- This `README.md` is not published.

## How it works

`.github/workflows/pages.yml` builds the site from `www/` plus this folder. The step `node scripts/build-tutorials.js` copies the tutorials across and writes the buttons into `index.html`.
It runs as part of the normal, manual **Deploy web version** workflow.

Preview locally:

```bash
mkdir _site && cp -R www/. _site/
node scripts/build-tutorials.js tutorials _site/tutorials
python3 -m http.server -d _site 8000     # open http://localhost:8000/tutorials/
```
