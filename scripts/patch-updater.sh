#!/usr/bin/env bash
# v3.14.0: prepares the generated Android project for IN-APP updates (download the new APK inside the app, then install it).
# Does three things, each safe to run twice:
#   1) copies scripts/native/ApkUpdaterPlugin.java into the app's Java sources,
#   2) registers the plugin in MainActivity (local plugins are not auto-registered like the npm ones),
#   3) adds the REQUEST_INSTALL_PACKAGES permission to AndroidManifest.xml (Android refuses to open the installer without it).
# The Capacitor template already contains a FileProvider ("${applicationId}.fileprovider") whose file_paths.xml has a
# <cache-path>, which is where the APK is saved. This script only checks that, and adds it if a future template drops it.
# Usage: scripts/patch-updater.sh [path/to/android/app/src/main]
set -euo pipefail

MAIN="${1:-android/app/src/main}"
MANIFEST="$MAIN/AndroidManifest.xml"
PKG_DIR="$MAIN/java/com/campus/events"
SRC="$(dirname "$0")/native/ApkUpdaterPlugin.java"

[ -f "$MANIFEST" ] || { echo "::error::$MANIFEST not found. Run 'npx cap add android' first."; exit 1; }
[ -f "$SRC" ]      || { echo "::error::$SRC is missing from the repository."; exit 1; }
[ -d "$PKG_DIR" ]  || { echo "::error::$PKG_DIR not found. Is the appId in capacitor.config.json still com.campus.events?"; exit 1; }

# 1) the plugin
cp "$SRC" "$PKG_DIR/ApkUpdaterPlugin.java"
echo "ApkUpdaterPlugin.java copied"

export MAIN MANIFEST PKG_DIR
python3 - <<'PY'
import os, re, sys

main, manifest, pkg_dir = os.environ["MAIN"], os.environ["MANIFEST"], os.environ["PKG_DIR"]

# 2) register the plugin in MainActivity
act = os.path.join(pkg_dir, "MainActivity.java")
if not os.path.isfile(act):
    sys.exit("::error::MainActivity.java not found in " + pkg_dir)
s = open(act, encoding="utf-8").read()
if "registerPlugin(ApkUpdaterPlugin.class)" in s:
    print("MainActivity: ApkUpdaterPlugin already registered")
else:
    # Capacitor's template is exactly:  public class MainActivity extends BridgeActivity {}
    new, n = re.subn(
        r"public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*\}",
        """public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(ApkUpdaterPlugin.class);   // in-app updates (scripts/native/ApkUpdaterPlugin.java)
        super.onCreate(savedInstanceState);
    }
}""", s, count=1)
    if not n:
        sys.exit("::error::MainActivity.java is not the stock Capacitor template, so the updater cannot be registered automatically. "
                 "Add  registerPlugin(ApkUpdaterPlugin.class);  before super.onCreate(...)  in MainActivity.onCreate.")
    open(act, "w", encoding="utf-8").write(new)
    print("MainActivity: ApkUpdaterPlugin registered")

# 3) permission
s = open(manifest, encoding="utf-8").read()
if "android.permission.REQUEST_INSTALL_PACKAGES" in s:
    print("AndroidManifest.xml: REQUEST_INSTALL_PACKAGES already present")
else:
    s, n = re.subn(r"(<application\b)",
                   '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n    \\1', s, count=1)
    if not n:
        sys.exit("::error::<application> tag not found in AndroidManifest.xml (Capacitor template changed?)")
    open(manifest, "w", encoding="utf-8").write(s)
    print("AndroidManifest.xml: REQUEST_INSTALL_PACKAGES added")

# the FileProvider that hands the APK to the installer must exist and must cover the cache folder
if "androidx.core.content.FileProvider" not in s or ".fileprovider" not in s:
    sys.exit("::error::The FileProvider (authority ${applicationId}.fileprovider) is missing from AndroidManifest.xml. "
             "The Capacitor template normally includes it; the updater needs it to open the downloaded APK.")
fp = os.path.join(main, "res", "xml", "file_paths.xml")
if not os.path.isfile(fp):
    sys.exit("::error::" + fp + " not found (the FileProvider paths file).")
x = open(fp, encoding="utf-8").read()
if "<cache-path" in x:
    print("file_paths.xml: cache-path already present")
else:
    x, n = re.subn(r"(<paths\b[^>]*>)", r'\1\n    <cache-path name="cem_update_cache" path="." />', x, count=1)
    if not n:
        sys.exit("::error::<paths> tag not found in file_paths.xml")
    open(fp, "w", encoding="utf-8").write(x)
    print("file_paths.xml: cache-path added")
PY
