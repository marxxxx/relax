#!/usr/bin/env bash
# Assemble the Pages site in <out-dir>: web/ of the checked-out commit (main) at
# the root, and web/ of every other origin branch under staging/<slug>/.
# Needs a full clone (all refs/remotes/origin/* fetched).
set -euo pipefail
out=${1:?usage: build-site.sh <out-dir>}
rm -rf "$out"; mkdir -p "$out/staging"

# Copy web/ of <ref> to <dir> and append ?v=<short sha of ref> to local .css/.js
# references in HTML and to relative ES module imports in JS, so each deploy
# busts browser caches for them.
export_web() {
  local ref=$1 dir=$2 version tmp
  version=$(git rev-parse --short=7 "$ref")
  tmp=$(mktemp -d)
  git archive "$ref" web | tar -x -C "$tmp"
  mkdir -p "$dir"; cp -r "$tmp/web/." "$dir"; rm -rf "$tmp"
  find "$dir" -name '*.html' -exec sed -i -E \
    "s#((href|src)=\"[^\":?]+\.(css|js))\"#\1?v=${version}\"#g" {} +
  find "$dir" -name '*.js' -exec sed -i -E \
    "s#((from|import) '\.\.?/[^'?]+\.js)'#\1?v=${version}'#g" {} +
}

export_web HEAD "$out"

links=""
while IFS= read -r ref; do
  name=${ref#refs/remotes/origin/}
  [ "$name" = HEAD ] || [ "$name" = main ] && continue
  if ! git cat-file -e "$ref:web" 2>/dev/null; then echo "skip $name (no web/)"; continue; fi
  slug=$(printf '%s' "$name" | tr '[:upper:]' '[:lower:]' | sed -E 's#[^a-z0-9._-]#-#g')
  export_web "$ref" "$out/staging/$slug"
  echo "staged $name -> staging/$slug/"
  links="$links<li><a href=\"$slug/\">$slug</a> <small>$(git rev-parse --short=7 "$ref")</small></li>"
done < <(git for-each-ref --format='%(refname)' refs/remotes/origin)

cat > "$out/staging/index.html" <<EOF
<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lichtung – Staging</title></head>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem">
<h1>Lichtung – Staging</h1><p><a href="../">Live-Version (main)</a></p>
<ul>${links:-<li>Keine Branches</li>}</ul>
</body></html>
EOF
