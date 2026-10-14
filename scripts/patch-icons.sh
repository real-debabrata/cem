#!/usr/bin/env bash
# v3.7.0: puts the Campus Events launcher icon and launch image into the generated Android project.
# It only copies files from brand/android/res over the files with the same names that Capacitor generates
# (mipmap-*/ic_launcher*.png, values/ic_launcher_background.xml, drawable*/splash.png), so it cannot break the Gradle build.
# Called by scripts/patch-android.sh. Safe to run twice.
# Usage: scripts/patch-icons.sh [path/to/android/app/src/main/res]
set -euo pipefail

RES="${1:-android/app/src/main/res}"
SRC="brand/android/res"
[ -d "$RES" ] || { echo "::error::$RES not found. Run 'npx cap add android' first."; exit 1; }
[ -d "$SRC" ] || { echo "::error::$SRC not found. Upload the brand/ folder to the repository."; exit 1; }

cp -R "$SRC"/. "$RES"/
echo "Launcher icon and launch image updated in $RES ($(find "$SRC" -type f | wc -l) files)"
