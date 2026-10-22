# Tutorials

Animated how-to pages, published on the website at **`/tutorials/`** (for example `https://cem.deba.indevs.in/tutorials/`).

They are **not part of the app**. This folder is outside `www/`, and the Android build only packs `www/`, so nothing here ends up in the APK. The main website does not link to it either.

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
<meta name="tutorial-order" content="2">   <!-- lower numbers come first; without it, tutorials are sorted A to Z -->
```

## Rules

- Each tutorial is one self-contained `.html` file (fonts, images, scripts inside the file) or may use a sub-folder such as `assets/`.
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
