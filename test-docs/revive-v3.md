# revive-v3: verification log

This file collects the offline verification evidence for the `fix/2.3.0` branch that either can't
run in CI output form or is worth keeping alongside the code (tarball/build comparisons, deferred
verify lines). Each task appends its own dated section below.

## Step 4 — link release baseline, honest engines, merge PRs 456/457

### Tarball comparison: master `src/` vs published `google-sheet-cli@2.2.0`

What was compared: the npm-published `google-sheet-cli@2.2.0` tarball's `lib/` (the actual bits
users install) against `lib/` built locally from `fix/2.3.0` (which is `master` plus this step's
changes) via `npm run build`.

Commands run (from `/tmp/claude-501`, with `google-sheet-cli` the clone on `fix/2.3.0`):

```sh
npm pack google-sheet-cli@2.2.0 --cache /tmp/claude-501/npm-cache-gsheet
tar -xzf google-sheet-cli-2.2.0.tgz -C tarball-2.2.0
(cd google-sheet-cli && npm run build)
diff -rq tarball-2.2.0/package/lib google-sheet-cli/lib
```

Verdict: **5 of 38 tarball files differ, all explained, none concerning.** No unexplained drift —
the branch's `src/` is the 2.2.0 source plus this step's own changes (PR 456's doc fix) and one
pre-existing docstring fix already on `master` before this task started.

| File | Reason |
|---|---|
| `lib/commands/data/append.js` | PR 456's own change, merged in this step — `--data=` dropped from the `data:append` usage example |
| `lib/commands/data/update.js` | Same PR 456 change, mirrored in the `data:update` example text |
| `lib/commands/worksheet/rename.js` | Pre-existing fix already on `master` (predates this task): the published 2.2.0 tarball has copy-pasted `worksheet:add` example text in the `rename` command's help — confirmed with `git show v2.2.0:src/commands/worksheet/rename.ts`, the bug is in the tagged 2.2.0 source itself. `master`'s `rename.ts` already carries the correct rename-specific example. |
| `lib/lib/google-sheet.js` | TypeScript namespace/enum compiled-output difference: `GoogleSheetCli = exports.GoogleSheetCli \|\| (exports.GoogleSheetCli = {})` (2.2.0 tarball, older `tsc`) vs `GoogleSheetCli \|\| (exports.GoogleSheetCli = GoogleSheetCli = {})` (this build, `typescript@^5.0.4`) — a compiler-version artifact, not a source change; semantically identical |
| `lib/lib/types.js` | Same `tsc`-version namespace-emit difference as above |

### Verify lines deferred to CI

- `npm test` — not run. It exercises a live Google Sheet and this sandbox has no service-account
  credentials for it (see plan Ruling R1). Deferred to CI, which has the credentials.
- `npx semantic-release --dry-run --no-ci` — not run locally. It's release tooling on the same old
  `@oclif`/`oclif` toolchain that already misbehaves under this sandbox's Node 26 (see the
  pre-commit hook note in the Step 4 task report); running it here risks another false signal from
  an environment mismatch rather than a real problem. CI runs Node 18/20/24 for this line, matching
  what the branch actually targets — deferred there.
- `git tag --merged master | grep v2.2.0` — not applicable yet; that verify line covers Step 7
  (merging `fix/2.3.0` back into `master`), not this step.
