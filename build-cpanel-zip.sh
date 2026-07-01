#!/usr/bin/env bash
# =============================================================================
# Build the cPanel deploy bundle: content-calendar-cpanel.zip
#
# The zip is a complete cPanel *document root* — the static React build + the
# PHP API — that you upload and Extract on the server. It DELIBERATELY EXCLUDES
# api/config.php (your secrets) and api/data/ (your live SQLite database), so
# extracting over an existing install never overwrites your data or settings.
#
# Usage (from the project root):   bash build-cpanel-zip.sh
# Requirements: node + npm, and the CLI tools rsync, zip, unzip, grep.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

ZIP="content-calendar-cpanel.zip"
STAGE=".cpanel-stage"

# Always restore a dev .env.local, even if the build fails partway.
restore_env() { [ -f .env.local.bak ] && mv -f .env.local.bak .env.local || true; }
trap restore_env EXIT

echo "==> 1/5  Production build (same-origin API)"
# The deployed frontend must call the API at a RELATIVE /api on the SAME domain.
# VITE_SAME_ORIGIN=1 makes the API base empty (relative). We also move any dev
# .env.local aside so a VITE_API_URL=http://localhost:... in it can't get baked
# into the production bundle.
[ -f .env.local ] && mv .env.local .env.local.bak
printf '# Production build: API is same-origin (/api).\nVITE_SAME_ORIGIN=1\n' > .env.production
npm run build            # = tsc --noEmit && vite build  -> outputs dist/
restore_env
trap - EXIT

echo "==> 2/5  Safety check — no localhost / dev URL leaked into the bundle"
if grep -rqE '127\.0\.0\.1|localhost:[0-9]' dist/assets; then
  echo "FATAL: a dev URL leaked into the production bundle. Aborting." >&2
  exit 1
fi

echo "==> 3/5  Stage the cPanel document-root layout"
rm -rf "$STAGE"; mkdir -p "$STAGE/api"
# Frontend: the whole built static site (index.html, assets/, logos, favicon,
# and the SPA-routing .htaccess) EXCEPT the demo sample photos.
rsync -a --exclude 'photos' --exclude '.DS_Store' dist/ "$STAGE/"
# Backend: ONLY these three files. No config.php and no data/ on purpose.
cp api/index.php api/.htaccess api/config.sample.php "$STAGE/api/"

echo "==> 4/5  Create $ZIP"
rm -f "$ZIP"
( cd "$STAGE" && zip -rqX "../$ZIP" . -x '*.DS_Store' )
rm -rf "$STAGE"

echo "==> 5/5  Done — contents:"
unzip -l "$ZIP"

# Guard rails — these must all pass. (Match the listing as a string so grep -q
# early-exit + pipefail can't give a false negative.)
LISTING="$(unzip -l "$ZIP")"
fail=0
[[ "$LISTING" == *"api/data"* ]]       && { echo "FAIL: api/data present";      fail=1; } || echo "OK: no api/data (live DB safe)"
[[ "$LISTING" == *"api/config.php"* ]] && { echo "FAIL: api/config.php present"; fail=1; } || echo "OK: no api/config.php (live secrets safe)"
[[ "$LISTING" == *"api/index.php"* ]]  && echo "OK: api/index.php present" || { echo "FAIL: backend missing"; fail=1; }
exit $fail
