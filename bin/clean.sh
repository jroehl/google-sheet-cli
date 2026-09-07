#!/usr/bin/env sh

# `oclif readme --multi` writes the package's own version into every "See code" link, and the
# in-repo version is always 0.0.0, so straight out of the generator the committed docs point at a
# tag that will never exist. This rewrites those links back to `master`. `npm run version` runs it
# immediately after the generator and its output is what gets committed, so this script's
# behaviour is load-bearing rather than cosmetic.
#
# It reads and writes through a temporary file instead of `sed -i`: BSD sed requires an argument
# after `-i` and GNU sed refuses one, so an in-place edit needs a fork test or gsed, and neither
# earns its keep here. The glob is expanded by the shell and every path is quoted at the point of
# use, so a checkout under a directory with a space in its name works.

set -eu

docs="$(cd "$(dirname "$0")/.." && pwd)/docs"

for filename in "$docs"/*.md; do
  # an unmatched glob comes back as the literal pattern
  [ -f "$filename" ] || continue
  tmp="$filename.clean.$$"
  sed 's/v0\.0\.0/master/g' "$filename" >"$tmp"
  mv "$tmp" "$filename"
done
