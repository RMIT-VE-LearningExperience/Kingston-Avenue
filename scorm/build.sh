#!/usr/bin/env bash
# Build a SCORM 1.2 package of the survey tool for Canvas.
#
#   ./scorm/build.sh            -> dist/kingston-survey-tool-scorm12.zip  (from survey-tool/)
#   ./scorm/build.sh survey-tool_v3 -> dist/kingston-survey-tool_v3-scorm12.zip
#
# The package is the tool's files verbatim plus imsmanifest.xml and scorm-api.js,
# with scorm-api.js injected into index.html before main.js. Three.js is still
# loaded from unpkg.com via the importmap, so the LMS player needs internet access.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-survey-tool}"
STAGE="$(mktemp -d)/${SRC}-scorm"
OUT="$ROOT/dist/kingston-${SRC}-scorm12.zip"

[ -f "$ROOT/$SRC/index.html" ] || { echo "no such tool folder: $SRC" >&2; exit 1; }
mkdir -p "$STAGE" "$ROOT/dist"
cp "$ROOT/$SRC/index.html" "$ROOT/$SRC/main.js" "$ROOT/$SRC/style.css" "$STAGE/"
mkdir -p "$STAGE/models"
cp "$ROOT/$SRC"/models/*.glb "$ROOT/$SRC/models/stages.json" "$STAGE/models/"
cp "$ROOT/scorm/scorm-api.js" "$ROOT/scorm/imsmanifest.xml" "$STAGE/"

# inject the SCORM wrapper ahead of the app module
perl -0pi -e 's|(\s*)(<script type="module" src="main.js[^"]*"></script>)|$1<script src="scorm-api.js"></script>$1$2|' "$STAGE/index.html"
grep -q 'scorm-api.js' "$STAGE/index.html" || { echo "failed to inject scorm-api.js" >&2; exit 1; }

# every packaged file must be listed in the manifest
for f in $(cd "$STAGE" && find . -type f ! -name imsmanifest.xml | sed 's|^\./||'); do
  grep -q "href=\"$f\"" "$STAGE/imsmanifest.xml" || { echo "imsmanifest.xml is missing <file href=\"$f\"/>" >&2; exit 1; }
done

rm -f "$OUT"
(cd "$STAGE" && zip -q -r -X "$OUT" .)
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
