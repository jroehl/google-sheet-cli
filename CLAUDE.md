# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An oclif 5 cli over the Google Sheets v4 API, and the `GoogleSheet` class it is built on, published as one npm package. `src/lib/google-sheet.ts` holds every Sheets operation; `src/commands/**` are nine thin oclif commands over it (`data:get|append|update`, `spreadsheet:add|get`, `worksheet:add|get|remove|rename`) and `src/lib/base-class.ts` holds the flags they share. The `gsheet.action` GitHub Action (same author, separate repo) is the main consumer of the library half, so a change to `GoogleSheet`'s behaviour lands in ~80 workflows and is not a private matter.

The library is published three ways: `google-sheet-cli` (the root, which also exports oclif's `run`), `google-sheet-cli/sheet` (side-effect free, no oclif in its module graph) and the deep `google-sheet-cli/lib/lib/google-sheet` path the action still uses. All three are declared in `package.json`'s `exports`; anything not listed there is sealed off.

## Commands

- `npm run build` compiles `src/` to `lib/` with `tsc -b`. `lib/` is gitignored, and `bin/run.js` resolves the command tree from it, so nothing that drives the real cli works before a build.
- `npm run test:unit` is the offline suite (180 cases). No credentials: `test/fake-sheets.ts` answers the Sheets API over an intercepted `https.request`, and `test/commands/offline.test.ts` swaps the client in through `src/lib/factory`. This is the only gate a pull request gets - run it.
- `npm test` is the full suite through nyc and additionally runs the live cases, which need `GSHEET_CLIENT_EMAIL`, `GSHEET_PRIVATE_KEY` and `TEST_SPREADSHEET_ID` and talk to one shared spreadsheet. They skip themselves without those. CI runs them only on pushes to `master` and `2.x`.
- `npm run cleanup` (`bin/clear-testsheet.sh`) deletes the worksheets test runs leave on that shared spreadsheet, classified by `bin/cleanup-classify.js`. It needs the same credentials and a build. `-- --dry-run` reports without deleting; use that first, always.
- `npm run version` runs `oclif readme --multi`, then `bin/clean.sh`, then stages `README.md` and `docs/*.md`. The husky pre-commit hook runs it after a build, so generated docs follow a flag change on their own.

## Conventions

- Adding or changing a command: the class in `src/commands/**` declares the flags, `src/lib/base-class.ts` holds the shared ones, and the docs regenerate themselves. Never hand-edit `docs/*.md` or the `<!-- usage -->` / `<!-- commands -->` blocks in `README.md`.
- Get the client from `factory.createGoogleSheet()`, never `new GoogleSheet()` inline. That named export is the only seam the offline command tests have, and it is deliberately not switchable through the environment.
- `throw new Error(...)`, never a bare string. 3.0.0 converted the last eight; the messages are pinned by `test/regression.test.ts`.
- `test/regression.test.ts` and `test/grid-growth.test.ts` pin 2.2.x behaviour. A red case there means a change nobody asked for, not a stale test - read it before touching it.
- `src/lib/table.ts` is a frozen copy of `@oclif/core@2.8.11`'s `ux.table`, and `js-yaml` is pinned to 3.x because that copy calls `safeDump`. Both are compatibility decisions with the reasoning in `CONTRIBUTING.md` and the evidence in `test-docs/revive-v3.md`.

## Release

`.github/workflows/test-and-release.yml` is the release path. Pull requests run the offline suite on Node 22 and 24, a build and a `./bin/run.js --help` smoke test. A push to `master` or `2.x` runs the live suite on Node 24, then the `publish` job runs `semantic-release`, which reads the Conventional Commit messages and publishes to npm. There is no `.releaserc`: semantic-release's defaults are what runs, and their default branch list already matches `2.x`.

Version lines: `latest` is 3.x and needs Node 22; the 2.x line stays installable through the `v2` dist-tag and is maintained on the `2.x` branch. The order of operations for the 3.0.0 publish, the dist-tag and the `2.x` branch's own configuration are in `test-docs/revive-v3.md` under *Step 16* and *Step 13*. All of it is the repository owner's, and each push needs their confirmation for that specific push.

## Status (2026-09-07)

2.3.0 is a fix release off `master`; the 3.0.0 work is on the `modernize` branch: oclif 2 → 5, a Node 22 floor, `@googleapis/sheets` in place of the whole `googleapis` bundle, `Error` instances everywhere, the `./sheet` subpath, and an offline command layer so the flag surface is checked before merge instead of after. Nothing is published, tagged or pushed yet. The README's "Migrating from 2.x" section is what a 2.x user acts on; `test-docs/revive-v3.md` is the evidence behind it.
