#!/usr/bin/env bash

# Removes the worksheets our test runs leave behind on the shared test spreadsheet.
#
# The spreadsheet is shared with the gsheet.action repository, so what may be deleted is decided
# by bin/cleanup-classify.js (allow-list, minimum age one hour) rather than here. This script
# only fetches the titles, prints every decision, and performs the deletions.
#
# Usage: bin/clear-testsheet.sh [--dry-run]

set -euo pipefail

dry_run=0
for arg in "$@"; do
  case "${arg}" in
    --dry-run) dry_run=1 ;;
    *)
      echo "usage: $(basename "$0") [--dry-run]" >&2
      exit 2
      ;;
  esac
done

if [ -z "${TEST_SPREADSHEET_ID:-}" ]; then
  echo "TEST_SPREADSHEET_ID is not set" >&2
  exit 1
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

titles="$("${root}/bin/run" spreadsheet:get -s "${TEST_SPREADSHEET_ID}" -r | jq -r '.sheets[].properties.title')"
decisions="$(printf '%s\n' "${titles}" | node "${root}/bin/cleanup-classify.js")"

printf '%s\n' "${decisions}" | while IFS=$'\t' read -r decision reason title; do
  printf '%-8s %s (%s)\n' "${decision}" "${title}" "${reason}"
done

if [ "${dry_run}" -eq 1 ]; then
  echo "--dry-run: nothing was deleted"
  exit 0
fi

# grep exits 1 on no match, which is the ordinary "nothing to clean up" case.
doomed="$(printf '%s\n' "${decisions}" | grep '^DELETE' | cut -f3- || true)"

if [ -z "${doomed}" ]; then
  echo "nothing to delete"
  exit 0
fi

printf '%s\n' "${doomed}" | while IFS= read -r title; do
  "${root}/bin/run" worksheet:remove -t "${title}" -s "${TEST_SPREADSHEET_ID}"
done
