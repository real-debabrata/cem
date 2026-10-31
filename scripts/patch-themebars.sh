#!/usr/bin/env bash
# v4.1.1: gives the Android app a full-screen look: the theme colour is painted behind the status bar (notification bar),
# the camera cut-out and the navigation bar, instead of a black bar. Safe to run twice. Does three things:
#   1) copies scripts/native/ThemeBarsPlugin.java into the app's Java sources,
#   2) registers the plugin in MainActivity and calls ThemeBarsPlugin.setup(this) once the window exists,
#   3) makes the app's base theme transparent-bar friendly (styles.xml) so there is no black flash before the app draws.
# Must run AFTER scripts/patch-updater.sh (that script rewrites MainActivity first). It also works if it runs on its own.
# Usage: scripts/patch-themebars.sh [path/to/android/app/src/main]
set -euo pipefail

MAIN="${1:-android/app/src/main}"
PKG_DIR="$MAIN/java/com/campus/events"
SRC="$(dirname "$0")/native/ThemeBarsPlugin.java"

[ -d "$MAIN" ]    || { echo "::error::$MAIN not found. Run 'npx cap add android' first."; exit 1; }
[ -f "$SRC" ]     || { echo "::error::$SRC is missing from the repository."; exit 1; }
[ -d "$PKG_DIR" ] || { echo "::error::$PKG_DIR not found. Is the appId in capacitor.config.json still com.campus.events?"; exit 1; }

# 1) the plugin
cp "$SRC" "$PKG_DIR/ThemeBarsPlugin.java"
echo "ThemeBarsPlugin.java copied"

export MAIN PKG_DIR
python3 - <<'PY'
import os, re, sys

main, pkg_dir = os.environ["MAIN"], os.environ["PKG_DIR"]

# 2) MainActivity
act = os.path.join(pkg_dir, "MainActivity.java")
if not os.path.isfile(act):
    sys.exit("::error::MainActivity.java not found in " + pkg_dir)
s = open(act, encoding="utf-8").read()
orig = s

STOCK = r"public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*\}"
FULL = """public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ThemeBarsPlugin.class);   // theme colour behind the status bar and camera (scripts/native/ThemeBarsPlugin.java)
        super.onCreate(savedInstanceState);
        ThemeBarsPlugin.setup(this);
    }
}"""

if re.search(STOCK, s):
    # Capacitor's untouched template (patch-updater.sh did not run first).
    s = re.sub(STOCK, FULL, s, count=1)
else:
    if "registerPlugin(ThemeBarsPlugin.class)" not in s:
        s, n = re.subn(r"([ \t]*)super\.onCreate\(\s*savedInstanceState\s*\)\s*;",
                       r"\1registerPlugin(ThemeBarsPlugin.class);   // theme colour behind the status bar and camera (scripts/native/ThemeBarsPlugin.java)\n\1super.onCreate(savedInstanceState);",
                       s, count=1)
        if not n:
            sys.exit("::error::MainActivity.java has no onCreate(...) calling super.onCreate(savedInstanceState). "
                     "Add  registerPlugin(ThemeBarsPlugin.class);  before it and  ThemeBarsPlugin.setup(this);  after it.")
    if "ThemeBarsPlugin.setup(this)" not in s:
        # the call goes right AFTER super.onCreate(...), where the window and the web view already exist
        s, n = re.subn(r"([ \t]*)(super\.onCreate\(\s*savedInstanceState\s*\)\s*;)",
                       r"\1\2\n\1ThemeBarsPlugin.setup(this);", s, count=1)
        if not n:
            sys.exit("::error::Could not add ThemeBarsPlugin.setup(this) to MainActivity.onCreate.")

if s != orig:
    open(act, "w", encoding="utf-8").write(s)
    print("MainActivity: ThemeBarsPlugin registered and set up")
else:
    print("MainActivity: ThemeBarsPlugin already registered")

# 3) styles.xml: transparent bars in the base theme, so the first frame is not a black bar.
styles = os.path.join(main, "res", "values", "styles.xml")
if os.path.isfile(styles):
    x = open(styles, encoding="utf-8").read()
    if "CEM_THEMEBARS" in x:
        print("styles.xml: already patched")
    else:
        items = ('\n        <!-- CEM_THEMEBARS (scripts/patch-themebars.sh): the colour behind the bars is painted at run time by ThemeBarsPlugin -->'
                 '\n        <item name="android:statusBarColor">@android:color/transparent</item>'
                 '\n        <item name="android:navigationBarColor">@android:color/transparent</item>'
                 '\n        <item name="android:windowBackground">@color/cem_bars_default</item>')
        # AppTheme.NoActionBar is the theme MainActivity uses (it extends AppTheme).
        x2, n = re.subn(r'(<style\s+name="AppTheme\.NoActionBar"[^>]*>)', r'\1' + items, x, count=1)
        if not n:
            print("styles.xml: AppTheme.NoActionBar not found, skipped (the plugin still paints the bars at run time)")
        else:
            open(styles, "w", encoding="utf-8").write(x2)
            # the default colour the base theme uses until the plugin paints the real one (Midnight Navy, same as the loading screen)
            colors = os.path.join(main, "res", "values", "cem_colors.xml")
            open(colors, "w", encoding="utf-8").write(
                '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="cem_bars_default">#10172B</color>\n</resources>\n')
            print("styles.xml: transparent bars and default colour added")
else:
    print("styles.xml not found, skipped (the plugin still paints the bars at run time)")
PY
