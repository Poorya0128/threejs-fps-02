#!/bin/sh
# Vendors three.js 0.187.0 into game/ exactly as the bounty requires, or checks it with --check.
# build/three.core.js  -> game/three.core.min.js   (unchanged bytes)
# build/three.module.js -> game/three.module.min.js (its two './three.core.js' specifiers -> './three.core.min.js')
set -eu
cd "$(dirname "$0")/.."

CORE_SHA=613e370f76638fdef83926642bf256dc9615684922de1ce1f63a8583e5d78578
MODULE_SHA=ef510bae547ab3789d6ed543333a8bf42510a8c70743b766c4e19039b976c26b

check() {
  ok=0
  echo "$CORE_SHA  game/three.core.min.js" | sha256sum -c - || ok=1
  echo "$MODULE_SHA  game/three.module.min.js" | sha256sum -c - || ok=1
  if [ "$ok" -ne 0 ]; then echo "three.js files do NOT match 0.187.0"; exit 1; fi
  echo "three.js 0.187.0 files OK"
}

if [ "${1:-}" = "--check" ]; then check; exit 0; fi

tmp=$(mktemp -d)
( cd "$tmp" && npm pack three@0.187.0 --silent >/dev/null && tar xzf three-0.187.0.tgz )
cp "$tmp/package/build/three.core.js" game/three.core.min.js
sed "s#'./three.core.js'#'./three.core.min.js'#g" "$tmp/package/build/three.module.js" > game/three.module.min.js
count=$(grep -o "'./three.core.min.js'" game/three.module.min.js | wc -l)
rm -rf "$tmp"
[ "$count" -eq 2 ] || { echo "expected 2 rewritten specifiers, found $count"; exit 1; }
check
