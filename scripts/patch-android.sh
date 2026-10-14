#!/usr/bin/env bash
# Patches the generated android/app/build.gradle so every build:
#   1) is signed with the permanent key (path in $CEM_KEYSTORE), and
#   2) has a versionCode that always goes UP (Android refuses updates otherwise).
# Usage: CEM_KEYSTORE=/path/to/keystore scripts/patch-android.sh [path/to/build.gradle]
set -euo pipefail

GRADLE="${1:-android/app/build.gradle}"
[ -f "$GRADLE" ] || { echo "::error::$GRADLE not found. Run 'npx cap add android' first."; exit 1; }

# versionName comes from www/ui.js (APP_VERSION='x.y.z')
VERSION_NAME="$(grep -oP "APP_VERSION='\K[0-9.]+" www/ui.js | head -1 || true)"
[ -n "$VERSION_NAME" ] || { echo "::error::Could not read APP_VERSION from www/ui.js"; exit 1; }

# versionCode = minutes since 1970. Always increases, never resets, survives re-runs,
# forks and new repositories (GitHub's run_number does not). Valid until the year ~6000.
VERSION_CODE="${VERSION_CODE:-$(( $(date +%s) / 60 ))}"

export GRADLE VERSION_NAME VERSION_CODE
python3 - <<'PY'
import os, re, sys
p = os.environ["GRADLE"]
s = open(p).read()

# 1) version
s, n1 = re.subn(r'versionCode\s+\d+', 'versionCode ' + os.environ["VERSION_CODE"], s, count=1)
s, n2 = re.subn(r'versionName\s+"[^"]*"', 'versionName "' + os.environ["VERSION_NAME"] + '"', s, count=1)
if not (n1 and n2):
    sys.exit("::error::versionCode/versionName not found in build.gradle (Capacitor template changed?)")

# 2) explicit signing config for the debug build type (replaces the implicit ~/.android/debug.keystore)
if "CEM_SIGNING" not in s:
    block = '''
    // CEM_SIGNING: permanent key, added by scripts/patch-android.sh
    signingConfigs {
        debug {
            storeFile file(System.getenv("CEM_KEYSTORE") ?: "${System.getProperty('user.home')}/.android/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }
'''
    s, n3 = re.subn(r'(\n\s*)buildTypes\s*\{', block + r'\1buildTypes {', s, count=1)
    if not n3:
        sys.exit("::error::buildTypes block not found in build.gradle")
open(p, "w").write(s)
print("Patched", p, "-> versionName", os.environ["VERSION_NAME"], "versionCode", os.environ["VERSION_CODE"])
PY

# v3.7.0: new launcher icon and launch image (brand/android/res). Same step, so the workflow file does not change.
bash "$(dirname "$0")/patch-icons.sh" "$(dirname "$GRADLE")/src/main/res"
