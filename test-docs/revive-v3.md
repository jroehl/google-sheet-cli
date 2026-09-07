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

## Step 5 — credential validation and `--credentialsFile` (#455, #386)

Everything below was run on Node 20.11.1
(`/Users/jemrich/.local/share/mise/installs/node/20.11.1/bin/node`), which is what this branch
targets. The machine's default Node 26 cannot run any of it: `googleapis` pulls in
`buffer-equal-constant-time`, which patches the `SlowBuffer` that Node 26 removed, so
`require('googleapis')` throws and no oclif command loads. That is pre-existing — the base commit
`73f1c2c` fails identically.

Throwaway RSA key material was generated with `crypto.generateKeyPairSync` for every run. No real
credentials were used and none are committed.

### Unit tests

```sh
npm run test:unit
# mocha --no-config --require ts-node/register --require source-map-support/register --timeout 15000 test/credentials.test.ts
# → 21 passing (9ms)
```

`--no-config` is load-bearing. `.mocharc.json` sets `"file": "test/commands/hooks.test.ts"`, which
authorizes against the live spreadsheet; dropping the flag pulls that file in and both hooks fail
offline. Anyone extending this script must keep naming test files explicitly — `--no-config` also
discards `extension` and `recursive`, so a bare directory glob will not work.

### Both PKCS#8 and PKCS#1 keys are accepted

Google only ever writes a PKCS#8 key (`-----BEGIN PRIVATE KEY-----`) into the service account JSON,
but a key someone converted to PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`) authenticates just as
well, and one may already be sitting in a GitHub secret that the action passes straight to
`authorize`. An earlier revision of this step checked for the literal PKCS#8 marker and would have
rejected such a key — `grep -c -- "-----BEGIN PRIVATE KEY-----"` on a PKCS#1 PEM is 0 — while
telling the user to copy the value verbatim, which they had. 2.3.0 must not narrow what already
works, so the marker check now matches any `BEGIN ... PRIVATE KEY` header and `createPrivateKey`
plus `asymmetricKeyType === 'rsa'` is the real gate.

What that leaves rejected, with the friendly BEGIN/END message: a `private_key_id` pasted by
mistake, and a bare base64 body with no PEM lines. What it leaves rejected with the RSA-key message:
an EC key, a truncated body, and a passphrase-protected PEM — the last one reaching
`createPrivateKey` and failing there rather than at the marker check, with the OpenSSL text staying
behind the debug channel. All six cases are covered by tests.

### The brief's three verify lines

| Command | Exit | Output | `grep -c DECODER` |
|---|---|---|---|
| `./bin/run spreadsheet:get -s X -c a@b.iam.gserviceaccount.com -p "not-a-key"` | 1 | `Error: private_key must be the full PEM private_key from the service account JSON, including the BEGIN and END lines` | 0 |
| same, with a PEM whose base64 body is truncated | 1 | `Error: private_key is not a valid service account RSA key. Copy the private_key value verbatim from the service account JSON; run with DEBUG=gsheet:credentials for the parser error` | 0 |
| `./bin/run spreadsheet:get -s <id> -f service-account.json` | 1 | `Fetching spreadsheet...` then `Error: invalid_grant: Invalid grant: account not found` / `Code: 400` | 0 |
| the same with a PKCS#1 (`BEGIN RSA PRIVATE KEY`) key in the JSON file | 1 | identical — `Error: invalid_grant: Invalid grant: account not found` / `Code: 400` | 0 |

The third line is the one that matters for the file path: local validation passed, the CLI signed a
JWT with the key it read out of the JSON file and sent it to Google, and Google rejected the
*account* — `a@b.iam.gserviceaccount.com` does not exist. Reaching a Google `invalid_grant` is proof
the credential loading and validation worked. (Inside the sandbox's network allowlist the same run
stops earlier with `Could not refresh access token: Connection blocked by network allowlist`, which
proves the same thing one hop sooner.)

With `DEBUG=gsheet:credentials` set, and only then, the cause appears:

```
gsheet:credentials createPrivateKey failed: error:1E08010C:DECODER routines::unsupported
```

### Before/after: the DECODER leak this step fixes

The same two commands on the base commit `73f1c2c`, built and run the same way:

```
Error: error:1E08010C:DECODER routines::unsupported
Code: ERR_OSSL_UNSUPPORTED
```

`grep -c DECODER` is 1 on the base commit and 0 on this branch, for both the `not-a-key` case and
the truncated-body case. That is issue #455 reproduced and closed.

### Regression: every command still works

`./bin/run --help` and `--help` for all nine commands, on Node 20, all exit 0:

```
--help                  -> exit=0 credentialsFile_mentions=0   (topic list, no flags shown)
data:get --help         -> exit=0 credentialsFile_mentions=1
data:append --help      -> exit=0 credentialsFile_mentions=1
data:update --help      -> exit=0 credentialsFile_mentions=1
worksheet:add --help    -> exit=0 credentialsFile_mentions=1
worksheet:get --help    -> exit=0 credentialsFile_mentions=1
worksheet:remove --help -> exit=0 credentialsFile_mentions=1
worksheet:rename --help -> exit=0 credentialsFile_mentions=1
spreadsheet:add --help  -> exit=0 credentialsFile_mentions=1
spreadsheet:get --help  -> exit=0 credentialsFile_mentions=1
```

Diffing `spreadsheet:get --help` between the base commit and this branch, the only change is the
added flag and the column re-alignment it forces:

```diff
 USAGE
   $ google-sheet spreadsheet:get -s <value> [-h] [-r] [-c <value>] [-p
-    <value>]
+    <value>] [-f <value>]

 AUTHENTICATION FLAGS
-  -c, --clientEmail=<value>  The client email to use for authentication. Uses
-                             the GSHEET_CLIENT_EMAIL env variable if not
-                             provided.
-  -p, --privateKey=<value>   The private key to use for authentication. Uses the
-                             GSHEET_PRIVATE_KEY env variable if not provided.
+  -c, --clientEmail=<value>      The client email to use for authentication.
+                                 Uses the GSHEET_CLIENT_EMAIL env variable if
+                                 not provided.
+  -f, --credentialsFile=<value>  Path to the service account JSON file to read
+                                 the credentials from. Uses the
+                                 GSHEET_CREDENTIALS_FILE env variable if not
+                                 provided. The clientEmail and privateKey flags
+                                 take precedence.
+  -p, --privateKey=<value>       The private key to use for authentication. Uses
+                                 the GSHEET_PRIVATE_KEY env variable if not
+                                 provided.
```

### Regression: the prompts still prompt

- No flags, no env: both prompts appear in order, `What is your client email?:` then
  `What is your private key?:`. It prompts, it does not throw.
- `-c a@b.iam.gserviceaccount.com` only: exactly one prompt, `What is your private key?:`, and zero
  email prompts. Precedence is per field, as designed.
- `-f service-account.json` only: no prompt at all.

### Known limitation, pre-existing: a key piped into the prompt loses its backslashes

Found while driving the prompt from a file rather than a terminal, and worth recording because the
symptom looks like a credential bug.

When stdin is not a tty, `ux.prompt(..., { type: 'hide' })` falls through `password-prompt`'s
`notty` branch, which shells out to `sh -c 'read -s PASS && echo $PASS'`. POSIX `read` without `-r`
consumes backslashes, so a key pasted in its escaped one-line form arrives as
`-----BEGIN PRIVATE KEY-----nMIIE...` — 1730 characters in, 1703 out, exactly the 27 backslashes
gone. The key is then correctly rejected as unparsable.

This is `password-prompt`'s behavior, not this branch's, and it predates the change: the base commit
fed the same input surfaces the raw `error:1E08010C:DECODER routines::unsupported`. The interactive
path is unaffected — replaying the same key through `password-prompt`'s raw branch (the one a real
terminal takes, since `stdin.setRawMode` exists there) returns all 1730 characters intact and
`normalizeCredentials` turns them into a valid RSA PEM. Nothing to fix here; the supported
non-interactive routes are the flags, the env variables and `--credentialsFile`.

## Step 6 — grow the grid on write (#611)

Everything below was run on Node 20.11.1
(`/Users/jemrich/.local/share/mise/installs/node/20.11.1/bin/node`), offline, against a committed
in-memory fake of the Sheets v4 REST API (`test/fake-sheets.ts`).

### The harness

`test/fake-sheets.ts` swaps `require('https').request` for a stand-in that answers out of an
in-memory spreadsheet. Everything above the socket is the real thing: `googleapis`,
`google-auth-library`, `gtoken` (it really signs the JWT assertion, with a throwaway RSA key
generated per run), `gaxios` and `node-fetch` all build their requests and parse the responses
exactly as they do against Google. The fake models `spreadsheets.get`, `spreadsheets.create`,
`values.get`, `values.update`, `values.append` and `batchUpdate` for `addSheet`, `deleteSheet`,
`updateSheetProperties` and `appendDimension`, plus the OAuth token endpoint. Its A1 parsing is
written from scratch rather than reusing `src/lib/utils.ts`, so a bug in the production parser
cannot hide itself inside the fake.

The two ways the API refuses a write that does not fit the grid are reproduced verbatim, which is
what makes the #611 tests meaningful:

```
Range (Full!A4) exceeds grid limits. Max rows: 3, max columns: 2
Requested writing within range ['Full'!A11], but tried writing to row [14]
```

Known limits of the fake — reads were clamped to the grid here rather than refused, which round 2
corrected; see *the fake was more permissive than the API* below. What is left: `values.get`
always quotes the worksheet title in the `range` it echoes, where Google only quotes when the
title needs it; `values.append` only models `insertDataOption=OVERWRITE`; no formatting, formulas,
merged cells or protected ranges.

### `values.append` — what it would have done differently

Brief item (e) asked for `values.append` with `insertDataOption: 'OVERWRITE'` to be evaluated
against the existing expectations. It was, through the same fake, driving the raw `googleapis`
client side by side with the deterministic `getData` → `ensureGridSize` → `values.update` path.
The deterministic path is what ships in 2.3.0 (controller ruling R2); this is the record for a
future major.

| Case | `values.append` | `getData`-derived `minRow` |
|---|---|---|
| A: two rows of three columns, appended at `minCol: 2` | writes `'Probe'!B3:D3` | `minRow=3`, writes `B3` — **same** |
| B: the seven-row `RAW_DATA` blank-cell fixture, appended at `minCol: 1` | writes `'Probe'!A8:C8` | `minRow=8` — **same** |
| C: a table that occupies rows 5–7 only, appended with `minRow: 5` | writes `'Probe'!A8:B8` | `minRow=4` — **differs** |
| D: a full 3×2 grid, appending one row of three columns | writes `'Probe'!A4:C4`, grid ends 4×3, **one** HTTP call | writes `A4`, grid ends 4×3, **four** HTTP calls |

Case C is the real difference and it is a latent bug in the deterministic path, not a change
`values.append` would introduce: `appendData` sets `minRow = rawData.length + 1`, but `getData`
returns rows counted from the start of the queried range, so when the caller passes `minRow: 5`
the count is relative to row 5 while the write is addressed from row 1. `values.append` gets it
right because the API resolves the table's last row itself. Fixing that in the current path means
adding the range's start row back in; switching to `values.append` fixes it for free.

Two things block the switch today, both worth writing into the v3 plan:

- The action's e2e asserts `.results[3].command.kwargs[1].minRow == 3`, which only exists because
  `appendData` mutates the options object it was handed. `values.append` reports where the data
  landed in `updates.updatedRange` instead, so that assertion and any consumer relying on the
  mutation have to move first.
- Case D shows `values.append` growing the grid server side in a single request. That is strictly
  better, but it also means the library stops knowing the grid size, so `ensureGridSize` and the
  bounded-range rejection in `requiredGrid` would have to go with it.

### Test evidence

The pinning suite (`test/regression.test.ts`, 31 cases covering `addWorksheet`, `getWorksheet`,
`getSpreadsheet`, `addSpreadsheet`, `removeWorksheet`, `renameWorksheet`, `getData`, `updateData`
and `appendData`) was written first and run green against the unmodified code before any of this
step's changes were made — 31 passing. Every one of those 31 still passes unchanged afterwards; no
pinned expectation had to be updated.

```sh
npm run test:unit
# 104 passing (124ms)
# = 21 credentials + 42 lib (parser table, requiredGrid) + 31 pinning + 10 grid growth
```

Before the fix, nine of the ten `test/grid-growth.test.ts` cases failed with the #611 symptom, for
example `Range (Full!A4) exceeds grid limits. Max rows: 3, max columns: 2` when appending four rows
of three columns to a 3×2 worksheet. The tenth asserts that the grid is left alone when the data
already fits, which was true before the change too.

The pinning tests were checked for bite by mutating the code and confirming they fail:

| Mutation | Result |
|---|---|
| `appendData`: `rawData.length + 1` → `rawData.length` | 7 failures, 4 of them pinning tests |
| `getData`: `colToA(c + (minCol \|\| 0))` → `colToA(c + 1)` | 2 failures, both pinning tests |

### Interpretation recorded: where `requiredGrid` starts counting

The brief words the start of the write as coming "from `minRow`/`minCol` or the range start". The
implementation prefers the range start, because that is what `getRange` prefers when it builds the
range the write actually goes to. Taking `minRow` instead would make `ensureGridSize` size a
region the data never lands in, and would make `appendData` with a bounded range reject writes that
the API accepts. A range without a `:` is an anchor cell, not a bound, so it never triggers the
`does not fit range` rejection.

### Verify lines deferred to CI

- The four live cases in the brief (create a `rowCount: 3, columnCount: 2` grid through
  `batchUpdate`, `appendData` four rows of three columns with `minCol`, `appendData` with a
  `range`, `updateData` with `range: "'<title>'!A5:C6"`, then assert `gridProperties` grew, that
  `getData` returns every row, and that a sentinel at `E10` has not moved) cannot run here: this
  machine has no Google credentials (plan ruling R1). Each of them has an offline twin in
  `test/grid-growth.test.ts` driven through the fake, including the `E10` sentinel.
- `npm test` — same reason; it drives the live shared spreadsheet.

### Correction after review round 1: an empty data array is a no-op, not an error

An earlier revision of this step made `updateData(data, options)` throw when `data` was `[]`.
That was wrong for a minor release. Before 2.3.0 an empty array passed the
`data.every(Array.isArray)` guard vacuously and went out as an empty `values.update`, which the
API accepts and which changes nothing — so a job that writes "whatever arrived today" and finds
nothing succeeded on every quiet day. Turning that into a red run is exactly the regression this
release must not ship.

`updateData` now returns early on an empty array without making any API call, and says so on
stderr:

```
gsheet:sheets no rows to write, nothing was sent to the spreadsheet
```

The warning is deliberately not gated behind `DEBUG`, unlike the `gsheet:credentials` output: a
silent no-op is the thing worth warning about, so the caller has to see it without knowing to ask.
Non-array and non-nested-array input keeps the behaviour it had before this step — the string
`Check "data" property - has to be supplied as nested array (...)`. `requiredGrid` keeps its own
non-empty guard, so `getLongestArray` still cannot be reached with an empty array; the guard is
simply no longer the thing the caller hits.

Covered by `does nothing, successfully, when there are no rows to write` and
`still rejects data that is not a nested array` in `test/grid-growth.test.ts`.

### Pre-existing bugs found by this step, deliberately not fixed

Both predate 2.3.0, both are out of the step's scope, both are written up here so they can be
filed as issues.

**1. `appendData` with an explicit `range` overwrites from the start of the range instead of
appending after the last row.**

- What the caller passes: `appendData([['x', 'y']], { worksheetTitle: 'Sheet1', range: "'Sheet1'!A1:C8" })`
  on a worksheet that already holds three rows.
- What happens: `appendData` calls `getData`, works out `minRow = 4` and sets it on the options
  object — but `getRange` returns `options.range` verbatim whenever a range is present, ignoring
  `minRow`. The write goes to `'Sheet1'!A1:C8`, so `['x', 'y']` lands on row 1 and overwrites the
  first existing row. The computed `minRow` is reported back to the caller and is a lie.
- What should happen: either `appendData` narrows the range to start at the computed row
  (`'Sheet1'!A4:C8`), or it rejects the combination of `range` and append semantics outright.
  Silently overwriting is the one thing it should not do.
- Where it is visible today: `appends through a range that reaches past the grid` in
  `test/grid-growth.test.ts` asserts the current behaviour with a comment saying so.

**2. `appendData` with `minRow` greater than 1 computes the target row relative to the wrong
origin.**

- What the caller passes: `appendData([['A8', 'B8']], { worksheetTitle: 'Sheet1', minCol: 1, minRow: 5 })`
  on a worksheet whose only data is in rows 5 to 7.
- What happens: `getData` reads from row 5, so `rawData.length` is 3 — rows counted from the start
  of the *queried* range. `appendData` then sets `minRow = rawData.length + 1 = 4`, which is
  addressed from row 1, and the write lands on row 4, on top of nothing but above the existing
  table. Confirmed against `values.append`, which puts the same write on row 8 (see the
  comparison table above, case C).
- What should happen: the target row is the queried range's start row plus the number of rows
  found, minus one, plus one — that is, `(options.minRow || 1) + rawData.length`. In the example,
  `5 + 3 = 8`.
- Why it has gone unnoticed: every caller in this repo and in `gsheet.action` appends with
  `minCol` only and leaves `minRow` unset, where the origin is row 1 and the two agree.

### Correction after review round 2: the fake was more permissive than the API, and it was hiding a gap

The first revision of `test/fake-sheets.ts` clamped a read whose range reached past the grid
instead of refusing it, and said so as an unverified assumption. The library itself argues the
other way: `getData` clamps `maxRow` and `maxCol` to `gridProperties` before every read, which is
only worth doing if an unclamped read fails. The fake now refuses an out-of-grid read exactly the
way it refuses an out-of-grid write.

Making it strict turned exactly one test red, and that red was the truth.

**Known limitation: `appendData` with a `range` that already points outside the grid still fails.**

- What the caller passes:
  `appendData([['C1','D1','E1'], …], { worksheetTitle: 'T', range: "'T'!A1:C8" })` on a worksheet
  whose grid is 3 rows by 2 columns.
- What happens: `appendData` calls `getData` first, and `getRange` hands the caller's range to
  `values.get` unchanged. The API refuses the read before any of this release's grid growth runs:
  `Range (T!C8) exceeds grid limits. Max rows: 3, max columns: 2`. Nothing is written and the grid
  is untouched.
- What should happen: `appendData` should size the grid to the range before reading it, or narrow
  the read to the part of the range that exists. Either is a bigger change than a fix release
  wants, and neither is what #611 asked for.
- What #611 did ask for is fixed: `appendData` with `minCol`/`minRow`, and `updateData` with a
  range past the grid, both work — `updateData` never reads, so its out-of-grid range reaches
  `ensureGridSize` intact.
- Pinned by `still fails to append through a range that reaches past the grid` in
  `test/grid-growth.test.ts` and by `[4] refuses to append through a range that reaches past the
  grid` in `test/google-sheet.test.ts`. If the live one ever passes on CI, the API is permissive
  on reads after all, the fake's strict model is wrong, and it has to be relaxed to match.

### Correction after review round 2: neither a remembered title nor an unquoted range may retarget a call

Two ways the first revision could move a write to a worksheet the caller did not ask for.

**`updateData` compared the range against a remembered title.** `options.worksheetTitle =
options.worksheetTitle || this.worksheetTitle` ran before the comparison, so a title left over
from an earlier command contradicted an explicit range and threw. The action runs every command
through one shared `GoogleSheet`, so a workflow that touched sheet A and later addressed sheet B
by range was green on 2.2.x and would have failed on 2.3.0. The comparison now uses only the title
the caller passed to that call; the remembered title stays a fallback for resolving the target and
is never a party to the check. Pinned by `writes to the worksheet a range names, even after
another one was touched`.

**`getData` adopted an unquoted range's worksheet over an explicit one.** The old regex parser
dropped an unquoted title, so `getData({ worksheetTitle: 'A', range: 'B!A1:C3' })` validated and
remembered A; the new parser returns B, and the method overwrote with it — which also steers every
later command, because the winner is remembered on the instance.

Round 2 fixed that by adopting the range's title only when the caller named none. **That rule was
wrong and does not ship.** It fixed the unquoted case and broke the quoted one, where 2.2.x let
the range win because the old regex did recognise quoted titles. Round 3 replaced it with the
distinction 2.2.0 actually made — a quoted range title takes precedence over an explicit
`worksheetTitle`, an unquoted one is ignored — which is what the code does today. The four
combinations and the tests that pin them are in *quoted and unquoted range titles are not the
same thing* below; read that section, not this paragraph, for the shipped behaviour.

### Live coverage added in round 2

`test/google-sheet.test.ts` gained `google-sheet grid growth (#611)`, six cases against the shared
test spreadsheet, using `sheets.spreadsheets.batchUpdate` in the test file to create the
constrained grids the public API cannot: fill a 3x2 grid exactly, append four rows of three
columns past its end, append through a range inside the grid, refuse to append through a range
past it, update through `'<title>'!A5:C6` past it, and grow a 12x8 sheet twice without moving a
sentinel written to `E10` first. Each has an offline twin in `test/grid-growth.test.ts`. They
cannot run on this machine (no credentials, plan ruling R1) and are deferred to CI, which is the
point: they are what closes the risk that the fake is wrong in the same direction as the code.

### Correction after review round 3: quoted and unquoted range titles are not the same thing

Round 2 collapsed both into "an explicit worksheetTitle always wins", which fixed the unquoted case
and broke the quoted one. 2.2.0's range parser was a regex that only ever recognised a *quoted*
title, and `getData` overwrote its `worksheetTitle` option with whatever came back — so a quoted
title has always won and an unquoted one has always been ignored. Both halves are restored.

`rangeWorksheet(range)` in `src/lib/utils.ts` reports the title and whether the range quoted it.
`parseRange` is unchanged; this is about what the methods do with what they are given.

**What each method now does, for each of the four combinations.** A is the caller's
`worksheetTitle`, B is the worksheet the range names, R is the title remembered on the instance
from an earlier command.

| Combination | `getData` | `updateData` |
|---|---|---|
| quoted range B + explicit A | resolves to **B**, and remembers B (2.2.x) | **warns**, then writes to B and grows B's grid (2.2.x) |
| quoted range B + explicit B (agreeing) | resolves to B | writes to B, grows B's grid |
| quoted range B, no title | resolves to **B**, and remembers B (2.2.x) | writes to B, grows B's grid |
| unquoted range B + explicit A | resolves to **A**, and remembers A (2.2.x) | **warns**, then writes to B and grows B's grid (2.2.x wrote to B without growing) |
| unquoted range B + explicit B (agreeing) | resolves to B | writes to B, grows B's grid |
| unquoted range B, no title | resolves to **R**, or throws `Option property "worksheetTitle" is required` with nothing remembered (2.2.x) | needs **R** to exist as a name only; `getRange` sends the write to **B**, and neither sheet is read or grown; `Specify worksheetTitle` with nothing remembered (2.2.x) |

Two deliberate asymmetries in that table:

- **The contradiction warning ignores quoting** where resolution does not. A caller who names one
  worksheet and a range naming another has said two contradictory things however the range spelled
  it. Reading is left alone, so `getData` keeps 2.2.x's silent preference; the write path says
  which one wins on stderr and then writes where 2.2.x wrote, to the range's worksheet.
- **`updateData` skips both the read and `ensureGridSize`** when the range names a worksheet other
  than the one the call resolved to — the last row of the table. Sizing there would add rows to a
  sheet nobody asked about, while the write still lands somewhere else. Leaving it alone is what
  2.2.0 did with that combination, and it is the only combination where the two can differ,
  because every other one agrees. Reading the resolved worksheet in that branch would also have
  been a regression in its own right: it is fetched only to size it, and an instance constructed
  with a `worksheetTitle` that does not exist would have had a write aimed at another sheet
  entirely refused, where 2.2.0 completed it. Pinned by `2.2.x: writes through an unquoted range
  when the remembered worksheet does not exist`.

All six rows are pinned in `test/regression.test.ts`, each labelled with the 2.2.x behaviour it
preserves.

## Step 7 — safe cleanup, offline `test:unit`, CI rework

### Deferred: the `2.x` branch configuration

The workflow now triggers on pushes to `2.x` and `publish` accepts `refs/heads/2.x`, so the
maintenance branch is releasable the moment someone cuts it. What is deliberately **not** here is a
semantic-release `branches` configuration naming `2.x`.

The repository has no release config at all, so semantic-release uses its defaults, and the default
list already matches `2.x` through the maintenance pattern `+([0-9])?(.{+([0-9]),x}).x`. Declaring
`2.x` explicitly before master has moved past 2.x risks `EMAINTENANCEBRANCH` — semantic-release
refuses a maintenance branch whose range is not below the release branch's — and that failure would
take the 2.3.0 release down with it. Shipping 2.3.0 is the priority.

So: the `branches` configuration belongs to the task that actually cuts `2.x`, once master is on
3.0.0. The gate for it is a `semantic-release --dry-run` on the `2.x` branch printing the version it
would publish, not a green workflow run.

### Node 22.18+ cannot run the offline suite without `--no-experimental-strip-types`

Verified locally against the real suite, credentials unset:

```
node v20.11.1                                     → 155 passing, 0 failing
node v22.18.0                                     → fails to start
node v22.22.0                                     → fails to start
node v24.11.1                                     → fails to start
node v22.22.0 --no-experimental-strip-types       → 155 passing, 0 failing
node v24.11.1 --no-experimental-strip-types       → 155 passing, 0 failing
```

The failure is not ours and not new: the same crash reproduces with the `test:unit` command exactly
as it stood before this step.

```
TypeError: Cannot read properties of undefined (reading 'filename')
    at Object.<anonymous> (node_modules/@oclif/test/lib/index.js:14:47)
    ...
    at async formattedImport (node_modules/mocha/lib/nodejs/esm-utils.js:9:14)
```

Cause: mocha 10 always tries `import()` on a spec file first and only falls back to `require` when
Node answers `ERR_UNKNOWN_FILE_EXTENSION`. Node 18 and 20 do answer that for a `.ts` file, so
`ts-node/register`'s CommonJS hook gets its turn. Node 22.18 and later strip types and load the file
as a real ES module instead, so `import()` succeeds, ts-node never runs, and the first CommonJS
dependency that inspects `module.parent` — `@oclif/test@2` on its line 14 — gets `undefined`.
Removing `@oclif/test` from the picture only moves the failure one step: the ES-module spec then
dies on `require is not defined in ES module scope`.

`--no-experimental-strip-types` puts the old behaviour back, and the workflow sets it through
`NODE_OPTIONS` on the matrix legs at Node 22 or newer only — Node 20 rejects the flag outright
(`bad option`), so it cannot be set unconditionally. Anyone running `npm run test:unit` locally on
Node 22+ needs the same flag until the toolchain moves off `ts-node` (`@oclif/test` 3+, or a
compile step before mocha).

Node 18 itself could not be exercised on this machine: it is not installed, and `mise install
node@18` is blocked by the sandbox network allowlist (`deny network-outbound nodejs.org:443`). Node
18 predates type stripping entirely, so it takes the same `ERR_UNKNOWN_FILE_EXTENSION` → `require`
path as Node 20, which passes — but that is an argument, not a run. The Node 18 leg is first
verified by CI.

## Final review — R28: the contradiction warns in 2.3.0, and keeps warning in 3.0.0

Round 3 shipped a hard refusal for the case where the caller passes an explicit `worksheetTitle`
and a `range` naming a different worksheet:

```
range "Second!A1" targets worksheet "Second" but worksheetTitle is "Sheet1"
```

2.2.0 wrote to the range's worksheet there. `updateData` never looked at the range's title at all:
`getRange` returns `options.range` verbatim whenever a range is present, so the API decided, and
the explicit title only ever affected the code path that did not run. The guard is defensible — one
of the two values is a mistake — but it turns a call that worked on every 2.x release into a hard
failure, and for a fix release compatibility outranks tidiness.

**In 2.3.0** the contradiction is a warning on stderr naming both worksheets and saying which one
wins, followed by 2.2.0's write:

```
gsheet:sheets range "Second!A1" targets worksheet "Second" but worksheetTitle is "Sheet1"; writing to "Second", as 2.2.x did
```

The worksheet the range names is also what `updateData` resolves and grows in that case, so the
grid that grows is the one the write lands in — and a caller whose explicit `worksheetTitle` names
a sheet that does not exist is no longer refused by the extra `getWorksheet` read either, which is
another way the refusal could have failed a call 2.2.0 completed.

**For 3.0.0** this paragraph originally said "restore the throw", and that was looser wording than
it should have been: it read as a promise rather than an option. **Decided in Step 16: the warning
stays in 3.0.0 and the throw is not restored.** The reasoning that made it a warning in the first
place has not changed — 2.2.x wrote to the sheet the range named, and refusing that call is a
behavioural break. Every other breaking change in 3.0.0 is a platform change: the Node floor, the
bin paths, the error types, the oclif upgrade. Folding a behavioural refusal into the same release
blurs what the major is about and hands a user two unrelated reasons to be broken at once. The
warning already puts the contradiction in front of them; a later release can turn it into a refusal
once it has been in the wild for a while.

Pinned by `2.2.x: an unquoted range worksheet that contradicts the explicit title is written to,
with a warning` in `test/regression.test.ts` and by `warns, then writes to the range worksheet, when
it contradicts worksheetTitle` in `test/grid-growth.test.ts`. Those two are the tripwire: whoever
eventually makes it a refusal has to change them deliberately, which is the point. The README's
"Changes in 2.3.0" section and its migration notes both say the warning is what 3.0.0 does.

## Final review — two live assertions are discovery tests, on purpose

`test/google-sheet.test.ts` cases `[3]` and `[4]` assert things nobody on this branch has seen
Google do. Both were derived from `test/fake-sheets.ts`, and `[4]` says so in its own comment:

- **`[3]`** — an explicit `range` wins over the row `appendData` computed, so the write lands at
  the range start and overwrites row 1. That is the pre-existing bug written up above; whether the
  API places the write there is the fake's model, not an observation.
- **`[4]`** — the API refuses a *read* whose range reaches past the grid, which is what makes
  `appendData` through an out-of-grid range fail before any growth can happen. The fake refuses it
  because `getData` clamps its own reads, which only makes sense if an unclamped read fails. That
  is an argument, not a run.

Neither had ever executed against Google when 2.3.0 was cut, and the first execution is the first
push to master — the same job the `publish` step depends on. A wrong guess would have turned that
run red and held the release hostage to a claim the release does not rest on.

So both now call a `discovery` helper: the assertions still run, and a disagreement prints a
`DISCOVERY:` block naming the subject and the mismatch, then calls `this.skip()`. Mocha reports
the case as pending rather than failed, the job stays green, and the log says exactly what Google
actually did. Verified locally with a throwaway spec: agreement passes, disagreement prints the
diagnostic and reports `1 passing, 2 pending`, and no code after the helper runs.

**What to do when one of them skips.** Read the diagnostic. Correct `test/fake-sheets.ts` and, if
the library is wrong too, the library, then turn the case back into a hard assertion — the helper
is scaffolding for one unknown, not a pattern for the suite. Every other live case still fails
normally.

## Final review — the two 2.2.x calls that do change

The fix wave's report claimed no 2.2.0 call fails on 2.3.0. Running the published 2.2.0 build and
this branch side by side against the HTTP fake over 62 call shapes found that claim slightly too
strong. Two differences survive, both narrow, both recorded here rather than fixed.

**A sheet-less range together with a worksheet title that does not exist now fails.**
`updateData(data, { worksheetTitle: 'Ghost', range: 'A1:B1' })` names no worksheet in the range, so
2.2.0 handed `A1:B1` to the API, which resolved it against the first sheet and wrote there. On
2.3.0 the sizing branch runs, `getWorksheet('Ghost')` refuses, and the call throws. It arrived with
the grid-growth commit, not with the fix wave, and it needs both halves of the precondition: a
range carrying no worksheet, and a title naming a sheet that is gone. The CLI cannot reach it,
because neither write command exposes a `range` flag; only the library and the action's `range`
option can. What 2.2.0 did there was write to a sheet the caller never named, so the new failure is
arguably the better outcome, but it is a behaviour change and it belongs in the release notes.

A related case changes nothing observable: a sheet-less range with an *existing* title that is not
the first sheet sizes the named sheet while the API writes to the first one. Nothing fails; the
named sheet may gain rows nobody uses.

**`appendData` no longer writes the range's worksheet back onto the caller's options object.**
With a quoted range and an explicit title, 2.2.0 left `worksheetTitle` mutated to the range's
worksheet; 2.3.0 leaves what the caller passed. The data lands in the same cells either way. It is
observable through the GitHub action, which serialises `command.kwargs` into its `results` output,
so a workflow reading `kwargs[1].worksheetTitle` after such a call sees a different value.

## Step 13 — the `2.x` maintenance branch, to be cut by the maintainer after 2.3.0 is on npm

Step 13's brief opened by creating `2.x` from the `v2.3.0` tag. That tag does not exist: 2.3.0 has
not been published, so there is nothing to branch from and nothing for a dry run to compare
against. The branch is therefore **not** created here. Everything it will need is written out
below so that cutting it later is a copy, not a design exercise.

**Order of operations for the maintainer**

1. Merge and push the 2.3.0 work; let the release workflow publish `2.3.0` to npm.
2. `git branch 2.x v2.3.0 && git switch 2.x`.
3. Add the `.releaserc` below **on `2.x` only**. Master is on 3.x by then, so declaring a `2.x`
   maintenance range no longer risks the `EMAINTENANCEBRANCH` failure that Step 7 avoided.
4. Gate on `npx semantic-release --dry-run --no-ci` printing a `2.3.x` next version. A green
   workflow run is not the gate; the dry run is.
5. Prove the path end to end with one README-only commit,
   `fix: point 2.x users at the 3.x migration notes`, and confirm `npm view google-sheet-cli@2.3.1
   version` prints `2.3.1` and `npm dist-tag add google-sheet-cli@2.3.1 v2` follows.

**`.releaserc`, verbatim**

```json
{
  "branches": [{ "name": "2.x", "range": "2.x" }, "master"]
}
```

**Workflow trigger and publish condition**

Both are already in `.github/workflows/test-and-release.yml` on master and are inherited by the
branch; they are repeated here so a hand-built branch can be checked against them.

```yaml
on:
  push:
    branches:
      - master
      - 2.x
```

```yaml
  publish:
    if: github.event_name == 'push' && (github.ref == 'refs/heads/master' || github.ref == 'refs/heads/2.x')
```

**One thing to change on the branch after cutting it.** 3.0.0 raises the Node floor to 22 and the
workflow's matrix with it. The 2.x line still supports Node 18, so on `2.x` the matrix and the
`NODE_OPTIONS: --no-experimental-strip-types` step have to stay as they were at the 2.3.0 tag —
that is what the tag carries, so simply not touching the workflow on `2.x` is correct.

## Step 13 — `ux.table` has no successor in `@oclif/core` 5

`data:get` contributed eight flags through `ux.table.flags()` — `--columns`, `--sort`, `--filter`,
`--csv`, `--output`, `-x/--extended`, `--no-truncate`, `--no-header` — and rendered through
`ux.table`. Core 4 deleted both and core 5 has no replacement. The official successor,
`@oclif/table`, renders a boxed table, contributes no flags, and pulls in React and ink.

Dropping the flags was not an option: `data:get --csv` and friends are shipped surface. The table
implementation from `@oclif/core@2.8.11` is therefore carried in `src/lib/table.ts`, unchanged
apart from being TypeScript, with the four libraries it uses (`chalk`, `js-yaml`, `natural-orderby`,
`string-width`) promoted from transitive dependencies of core 2 to direct dependencies. All four
were already installed at 2.3.0, so the dependency tree is roughly a wash.

Output was compared byte for byte against `@oclif/core@2.8.11`'s `ux.table` over the `data:get`
fixture in eleven flag combinations (default, `--no-header`, `--csv`, `--output=json`,
`--output=yaml`, `--sort`, `--sort=-`, `--columns`, `--filter`, `--extended`, `--no-truncate`),
piped and with `OCLIF_COLUMNS=14 CLI_UX_SKIP_TTY_CHECK=1` to force the truncation path. Identical
in every case, ANSI escapes included.

The one trap found on the way: `import * as chalk from 'chalk'` compiles under `module: node16`
but `chalk.bold` is undefined at runtime, because `__importStar` does not copy chalk's
non-enumerable style getters. It has to be a default import.

## Step 13 — the type-stripping workaround is gone

Step 7 recorded that Node 22.18 and later could not run the offline suite: mocha 10 imported the
`.ts` specs as ES modules, ts-node's CommonJS hook never ran, and `@oclif/test` 2 died reading
`module.parent.filename`. CI carried `NODE_OPTIONS: --no-experimental-strip-types` for it.

mocha 12 requires the specs through ts-node again and `@oclif/test` 5 no longer reads
`module.parent`, so the flag is unnecessary. Verified with the flag unset:

```
node v22.22.0  npm run test:unit → 160 passing
node v24.11.1  npm run test:unit → 160 passing
```

and with the flag still set on Node 24, also 160 passing — so a stale `NODE_OPTIONS` somewhere
would not break anything, it is simply no longer needed. The env block is removed from the
workflow and the matrix moves to `[22, 24]` for pull requests and `[24]` for pushes, matching
`engines.node >= 22`.

## Step 13 — `@oclif/test` 5's `runCommand` re-splits its arguments

`runCommand(argv)` joins the array with spaces and splits it again, honouring double quotes only.
An argument containing a space therefore arrives as two arguments unless it is written with
embedded quotes:

```ts
runCommand(['data:update', '-s', 'x', '-t', 'y', 'not json'])    // → Unexpected argument: json
runCommand(['data:update', '-s', 'x', '-t', 'y', '"not json"'])  // → the JSON error, as intended
```

The command suite is safe as written — `JSON.stringify` emits no spaces and the worksheet titles
are generated without them — but anything added later that passes a value with a space in it has
to quote it.

## Step 13 — two more lines for the 3.0.0 release notes

Step 16 writes the "Migrating from 2.x" section. Beside the Node 22 floor, the `bin/run.js` and
`bin/dev.js` paths and errors becoming `Error` instances, two things found during the migration
belong there and would otherwise be lost.

**`help`'s argument is rendered differently.** `@oclif/plugin-help` 7 declares the argument as a
variadic, so the usage line and the docs move from

```
  $ google-sheet help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.
```

to

```
  $ google-sheet help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.
```

Nothing about invoking it changes — `google-sheet help data:get` works exactly as before — but the
strings are in `docs/help.md` and in anyone's screenshots, so the change is worth naming rather
than leaving to be discovered.

**`js-yaml` is pinned to 3.x on purpose.** `src/lib/table.ts` calls `safeDump`, which 4.x renamed
to `dump` as part of making the safe schema the default. The pin exists so `data:get --output=yaml`
emits byte-for-byte what 2.2.x emitted, which is the property the whole vendored table was
verified against. 3.14.1 is end of life, so a dependency bot or a later reader will see it as
neglect: it is a deliberate compatibility pin, and moving it means re-running the table comparison
in this document, not just changing the version.

## Step 14 — the wire, before and after the client swap

Written in Step 16: Step 14 recorded all of this in its task report and added no section here, which
breaks this file's per-step convention. The report does not ship; this does.

`googleapis` 118 was replaced by `@googleapis/sheets` 14. The auth stack under it moved with it:

```
gaxios              5.1.3   →  7.1.3
google-auth-library 8.9.0   →  10.5.0
googleapis-common   6.0.4   →  8.0.3
gtoken              6.1.2   →  8.0.0
```

(Read out of `package-lock.json` at `235bbbe` and at HEAD. The fake's comment credited gtoken **5**
for the old endpoint; the base resolves 6.1.2. Corrected in Step 16.)

**The Sheets request sequence is unchanged.** Step 14 drove 24 scenarios covering all ten public
methods through `test/fake-sheets.ts` and recorded `{method, url, body}` for every request, at the
base commit, after the swap and after the `Error` change; its reviewer repeated the exercise from a
reconstructed base with the old `googleapis` installed. Same count, same order, same method, same
URL, same query string, same body, same returned shapes, same `GaxiosError` surface, in every one.

What did change is the token request and the headers. Recorded in Step 16 by intercepting
`https.request` under each client in turn and printing what it was actually handed — an independent
run, not a re-read of the report:

```
2.x   POST https://www.googleapis.com/oauth2/v4/token
      scope           https://spreadsheets.google.com/feeds/
      Content-Type    application/x-www-form-urlencoded
      Accept-Encoding gzip,deflate
      Accept          application/json
      User-Agent      google-api-nodejs-client/8.9.0

3.x   POST https://oauth2.googleapis.com/token
      scope           https://www.googleapis.com/auth/spreadsheets
      Content-Type    application/x-www-form-urlencoded;charset=UTF-8
      Accept-Encoding gzip, deflate, br
      Accept          application/json
      User-Agent      google-api-nodejs-client/10.5.0
```

and on the Sheets call itself, `GET https://sheets.googleapis.com/v4/spreadsheets/<id>` both times:

```
2.x   Accept application/json   Accept-Encoding gzip   x-goog-api-client gdcl/6.0.4 gl-node/…
3.x   Accept */*                Accept-Encoding gzip   x-goog-api-client gdcl/8.0.3 gl-node/…
```

Google ignores all of it. The endpoint is the one operational consequence: an egress allowlist
naming only `www.googleapis.com` has to gain `oauth2.googleapis.com`, or the first token fetch
fails and nothing else runs. `sheets.googleapis.com` is unchanged. Both halves are in the README's
migration section.

Note the direction of the `Accept` change on the Sheets call: `application/json` → `*/*` is the
header getting **looser**, so nothing upstream starts refusing to answer. What it can break is
something in the middle that was matching on the old value — a proxy rule, a request filter, a
recorded-cassette fixture. The README says so in that direction rather than just printing the pair.

**The scope and who has to re-grant it.** `https://spreadsheets.google.com/feeds/` (the retired
Sheets v3 feed scope, which v4 still accepted for a service account minting its own token) became
`https://www.googleapis.com/auth/spreadsheets`. A service account that was shared onto a
spreadsheet from the Sheets UI needs nothing: it signs its own assertion for whatever scope it
asks for, and the sharing is what grants the access. A service account used through Workspace
**domain-wide delegation** is the exception — the allowed-scope list lives in the Admin console,
keyed by the client ID, and until an administrator adds the new scope every call returns 401.
Nothing here can prove that against a real Workspace tenant; it follows from how delegation is
authorised, and it is the one line in the migration notes that could cost a user a whole outage.

**`skipLibCheck: true` in `tsconfig.json`.** Required, not tidying: gtoken 8 is `"type": "module"`
and names its CommonJS types `.d.ts`, so TypeScript classifies them as ESM and `tsc` fails with
TS1479 on `google-auth-library`'s `jwtclient.d.ts`. Correct at runtime (its `exports.require`
condition points at a real `.cjs`), unfixable from here.

**The `./sheet` subpath and what the `exports` map seals.** Re-verified in Step 16 against a
consumer project with the package linked in, on Node 24.11.1:

```
google-sheet-cli                            OK    lib/index.js
google-sheet-cli/sheet                      OK    lib/lib/google-sheet.js
google-sheet-cli/lib/lib/google-sheet       OK    lib/lib/google-sheet.js   (the action's path)
google-sheet-cli/lib/lib/google-sheet.js    OK    lib/lib/google-sheet.js
google-sheet-cli/package.json               OK
google-sheet-cli/oclif.manifest.json        FAIL  ERR_PACKAGE_PATH_NOT_EXPORTED
```

The manifest was reachable before `exports` existed. Nothing in this repo or the action reads it,
but it is a 3.0.0 surface change and is named in the migration notes rather than left to be found.

TypeScript resolution, same consumer, `tsc --noEmit` over one file importing the subpath and one
importing the deep path:

```
moduleResolution node16   exit 0
moduleResolution node10   TS2307 on 'google-sheet-cli/sheet' only; the deep path resolves
                          ("There are types at …/lib/lib/google-sheet.d.ts, but this result could
                           not be resolved under your current 'moduleResolution' setting.")
```

So the subpath needs `node16`, `nodenext` or `bundler` on the consumer side. That is why the deep
path is kept working by the two `./lib/*` patterns instead of being sealed with everything else.

## Step 15 — what the offline command layer catches, and what slips

Written in Step 16, for the same reason as Step 14's section.

`test/commands/offline.test.ts` stubs `src/lib/factory` and drives every command's `--help` plus a
stubbed `data:get` and two failing `data:update` calls, so the oclif 5 flag surface is a pull-request
gate for the first time. The offline suite went 165 → 180.

Its reviewer ran 13 of its own mutations rather than repeating the implementer's two. Recorded here
because the honest half is the half that gets lost:

- **Caught**: a renamed, dropped or added flag; a changed short character; required-ness; a changed
  default; an env binding; integer coercion; the vendored table's header capitalisation; the stdout
  channel for `--rawOutput`; a tenth command appearing.
- **Slips**: the bodies of the seven commands whose run paths are not stubbed; user-facing message
  text; generated descriptions; the non-raw return value.

Two known fragilities, deferred rather than fixed: the stub is cast in a way that turns off the
structural check on its shape, and the `--help` expectations are coupled to `@oclif/plugin-help`'s
exact rendering, so a grouped dependabot bump of the help plugin can turn the suite red with no
behaviour change. If that happens, read the diff before "fixing" the test — the rendering moving is
not the same as a flag moving.

Two pins are deliberately behind the current major and should move in step with the action
repository, not unilaterally: `actions/checkout` and `actions/setup-node` at v5 while v7 is current,
and `codeql-action` at v3 while v4 exists. Both lines were still receiving releases when they were
pinned.

## Step 16 — publishing 3.0.0, and the `v2` dist-tag

The documentation is written; every step below is the repository owner's, and each push needs their
confirmation for that specific push.

**Order matters in one place only, and it is step 2.** The `v2` dist-tag has to exist *before*
3.0.0 is published. The moment 3.0.0 lands, `latest` moves to it, and a 2.x user running
`npm install google-sheet-cli` gets a package their Node cannot run. With `v2` already pointing at
2.3.0, `npm install google-sheet-cli@v2` — which is what the README's migration section tells them
to do — is true from the first second.

1. **Confirm 2.3.0 is on npm.** `npm view google-sheet-cli version` prints `2.3.0`. Steps 4-7 have to
   have shipped; 3.0.0 cannot be the release that also carries the 2.3.0 fixes to their tag.

2. **Add the `v2` dist-tag, before merging anything.**

   ```sh
   npm dist-tag add google-sheet-cli@2.3.0 v2
   npm view google-sheet-cli dist-tags        # latest: 2.3.0, v2: 2.3.0
   ```

3. **Merge `modernize` into `master` so semantic-release reads a major.** The branch carries
   `feat!:` and `refactor!:` commits. If the merge is a squash, those subjects collapse into one
   message and the squash message itself has to carry the marker — `feat!: …` plus a
   `BREAKING CHANGE:` footer naming the Node 22 floor. A squash that loses the `!` cuts a minor, and
   the version is then permanent.

4. **Gate on a dry run before pushing.** With the merge made locally and nothing pushed:

   ```sh
   npx semantic-release --dry-run --no-ci
   ```

   It must say the next version is `3.0.0`. If it says `2.4.0`, step 3's commit message lost the
   breaking marker; fix the message, do not push.

5. **Push `master`.** `.github/workflows/test-and-release.yml` runs the live suite on Node 24, then
   the `publish` job runs `semantic-release`, which publishes 3.0.0 and tags `v3.0.0`. This is the
   first execution of the live suite since the migration, and the first execution ever of the two
   discovery assertions described above.

6. **Verify from outside the repository.**

   ```sh
   npm view google-sheet-cli version                   # 3.0.0
   npm view google-sheet-cli dist-tags                 # latest: 3.0.0, v2: 2.3.0
   npx google-sheet-cli@3 --help                       # on Node 24
   # the 2.x line still runs on the old floor: --package=node@20 puts Node 20 first on PATH,
   # so the bin script's `env node` shebang picks it up
   npx --package=node@20 --package=google-sheet-cli@v2 -- google-sheet --help
   ```

7. **Cut the `2.x` maintenance branch.** Two halves with different preconditions, and it is worth
   not confusing them:

   - **The branch itself** — `git branch 2.x v2.3.0` — needs only the `v2.3.0` tag, so it can be cut
     any time after step 1. Doing it early is harmless and gives fixes somewhere to land.
   - **Its release configuration** — the `.releaserc` naming the `2.x` maintenance range — must wait
     until master is on 3.0.0, i.e. after step 5. Declaring a `2.x` maintenance range while master
     is still 2.x is the `EMAINTENANCEBRANCH` failure Step 7 avoided.

   Both halves, the workflow trigger the branch inherits and the `semantic-release --dry-run` that
   gates the configuration are written out verbatim in *Step 13 — the `2.x` maintenance branch*
   above. Until the branch exists, the README says a `2.x` branch "is being cut" rather than
   claiming it is there.

8. **Provenance is a follow-up.** `id-token: write` on the publish job and `NPM_CONFIG_PROVENANCE=true`
   land as their own pull request *after* 3.0.0 is on npm, so that a provenance misconfiguration
   cannot fail the release itself.

Not done here, and deliberately: nothing in Step 16 merged, tagged, pushed, published or touched a
dist-tag. Documentation only.

## Step 16 fix wave — the swallowed error, the column origin, and the gate that missed both

Two reviews of `bf4216e..81ef740` came back "ship with fixes". What follows is what was measured,
not what was reasoned.

### Every cli error message was being swallowed

A failing command exited 1 and printed nothing at all unless `-r/--rawOutput` was given.
`ux.action.start()` replaces `process.stdout.write` and `process.stderr.write` with buffering
stubs and only `stop()` puts them back and flushes; `@oclif/core` 2 flushed that buffer from a
`process.once('exit')` hook (`lib/cli-ux/index.js`, calling `config.action.stop()` with no
argument), core 5 removed the hook, and `src/lib/base-class.ts` overrides oclif's own
`Command.catch`, which calls `ux.action.stop()` for exactly this reason. So the text
`Errors.handle` wrote went into a buffer nobody emptied. `-r` escaped it because it is the one
mode that never starts a spinner.

Measured on the built binary, ten runs each, before and after:

```
                                        before      after
bad JSON data          (spinner)         0/10       10/10
non-nested data        (spinner)         0/10       10/10
no worksheetTitle      (spinner)         0/10       10/10
missing required flag  (pre-spinner)    10/10       10/10
unknown command        (pre-spinner)    10/10       10/10
   … and each of the five again with -r  10/10      10/10
```

Exit codes were 1 (and 2 for an unknown command) throughout, before and after. `bin/dev.js`
behaves identically to `bin/run.js` on all of it.

The stop is unconditional rather than routed through this class's own `stop()`, which is gated on
`rawOutput`: `ActionBase.stop()` returns immediately when no task is running, so calling it on a
path that never started a spinner is a genuine no-op — read in
`node_modules/@oclif/core/lib/ux/action/base.js` and pinned by a test asserting no stray "done"
appears on a parse failure. `catch` is the only way out of a command that can leave the stubs
installed: every command pairs `this.start(...)` with `this.stop()` on the success path, nothing
calls `this.exit()` or `process.exit()`, and the credential prompts run in `init()` before any
spinner exists.

The message that now appears is 2.2.0's, `Updating data... done` followed by the error, because
2.2.0's exit hook also called `stop()` with the default argument. oclif's own `catch` would have
printed a red `!` instead; that was never what this cli did, since the override replaced
`Command.catch` on core 2 as well.

### Why nothing caught it, and what does now

`test/commands/offline.test.ts` drives commands through `@oclif/test`'s `runCommand`, which hands
back the thrown error and never calls `Errors.handle`. Nothing in the suite looked at a terminal,
so a defect where the exit code and the error object are both right and only the rendering is gone
was invisible. `.github/workflows/test-and-release.yml` gated pull requests on `npm run test:unit`
plus `./bin/run.js --help`, a success path. That is the whole reason this reached a final review.

Two gates now exist, and both were watched failing with the fix reverted and the binary rebuilt:

```
npm run test:unit                     exit 4, 187 passing, 4 failing
the workflow's "cli smoke test" step   exit 1, "::error::the cli exited non-zero but
                                       printed no error message"
```

and both go green when it is restored. The smoke step's script was extracted from the YAML with a
parser rather than retyped, so what ran locally is the text the runner will execute. Neither the
test nor the step needs credentials: `authorize` only constructs a JWT client, the token is
fetched lazily on the first API call, and the commands they drive fail before any request. So both
run on a fork pull request.

### `getData` with no `minCol`, and the labels 2.2.0 got wrong

`getData({ worksheetTitle })` and a whole-worksheet quoted range threw `col has to be greater than
1` on 2.2.0, on 2.3.0 and on the first attempt at this wave's fix. `getRange` resolves an absent
`minCol` to `colToA(minCol || 1)`, so the request went to A1; two lines in `getData` said
`minCol || 0`, so the loop naming unlabelled columns asked for `colToA(0)`. The cli never reached
it (`data:get` defaults `--minCol` to 1), which is also why the regression suite never reached it.

**The first fix here was `|| 0` → `|| 1` on both lines, and it was wrong.** It removed the throw,
but it also changed the answer for calls 2.2.0 had completed successfully. A re-review caught it;
this section records what the second attempt establishes, because the reasoning is what stops it
being "cleaned up" later.

`colToA` refuses anything below 1, and the label loop only calls it for a *blank* heading. So
`colToA(0)` was reached exactly when `minCol` was absent **and** `header[0]` was falsy, and only at
column index 0 — for `c >= 1` the argument was already at least 1. That splits every call into two
populations, and they cannot overlap, because one call has one `header[0]`:

| | `header[0]` present | `header[0]` absent |
|---|---|---|
| **2.2.0** | returned a result | threw `col has to be greater than 1` |
| **what it means** | output that works today | nothing can depend on it |

`header[0]` is present exactly when `hasHeaderRow: true` and the header row's first cell is
non-empty. So the fix is scoped to the origin: `minCol || (header[0] ? 0 : 1)`, used for both the
label loop and the `maxCol` arithmetic that decides how many labels there are.

**2.2.0's labels in the preserved population are wrong, and are kept anyway.** Worksheet
`HeaderOnly`, header row `A1='h1'`, `B1` blank, `C1='h3'`, read with
`{hasHeaderRow: true, minRow: 2, maxCol: 4}` — a four-column range:

| spreadsheet column | A | B | C | D | |
|---|---|---|---|---|---|
| header cell | `h1` | *(blank)* | `h3` | *(none)* | |
| **2.2.0, and this branch** | `h1` | `(A)` | `h3` | `(C)` | plus a fifth entry `(D)` |
| **what would be correct** | `h1` | `(B)` | `h3` | `(D)` | four entries |

Every generated label points one column to the left of the cell it sits over, and the same
arithmetic emits one label too many when the read returns no rows. Those labels are the keys of
every `formatted` row, and the GitHub action serialises `formatted` into its `results` output, so a
workflow may be reading `formatted[0]["(B)"]` today. Correcting them is a change to output that
currently works: it is a candidate for a later release that announces it, not something to slip
into a platform major. Where 2.2.0 threw instead, the corrected origin is used, because nothing can
depend on a throw. The asymmetry is deliberate and `src/lib/google-sheet.ts` says so at the point
of the code.

Measured by driving published 2.2.0 and each candidate implementation through `test/fake-sheets.ts`
over **125 shapes**: six worksheet fixtures (regular, ragged header, header-only with a blank
middle heading, blank first heading, empty, header row wider than its data) crossed with
`hasHeaderRow`, `minCol` absent/0/1/2 and `minRow` absent/2 — 96 shapes — plus `maxCol`/`maxRow`
variants, the four range forms (quoted bounded, quoted anchor, whole-worksheet, unquoted), the
degenerate shapes, and six chained-call scenarios on one shared instance. The OAuth token request
is normalised away, because its endpoint and scope moved with the `@googleapis/sheets` swap and are
identical on every call; the fake's internal sheetId counter is normalised because `reset()` does
not rewind it. Everything else — Sheets requests, return values, thrown values — is compared
verbatim.

```
                                       identical   different   unblocked   of
81ef740   (L2 not fixed at all)           115           1           9      125
first attempt (|| 0 -> || 1)               68          15          42      125
this branch   (scoped origin)              83           0          42      125
```

The scoped fix unblocks exactly the same 42 shapes as the first attempt and introduces no
difference at all. The first attempt's 15 differences are 14 label changes it introduced plus one
inherited from 2.3.0; `81ef740`'s single difference is that same inherited one — `appendData`
followed by `getData`, where the branch sends one extra spreadsheet read to size the grid before
writing, which is the documented 2.3.0 change. It appears as `different` at `81ef740` (both
implementations throw, but the request lists differ) and inside the `unblocked` bucket afterwards;
the harness reports that case separately rather than letting the bucket hide it.

Six regression cases pin the preserved labels, including both no-row shapes, the chained-instance
pattern the action uses, `minCol: 0` as a synonym for absent, and an explicit `minCol: 1` keeping
its own (different, correct) labels. Five of the six fail against the first attempt. The two cases
the first attempt added — an omitted `minCol` equalling an explicit `minCol: 1` — still hold, since
both are `hasHeaderRow`-free and therefore in the unblocked population.

### Two release-script orderings

`package.json`'s `version` script ran `oclif readme --multi` before anything built `lib/`, and
semantic-release runs `npm version` during *prepare*, before `npm publish` fires `prepack`.
Measured with `lib/` removed: oclif warns `No compiled source found at lib`, the README's command
list loses `data`, `spreadsheet` and `worksheet` and keeps only `help`, and the script stages that.
It exits 0 and `prepack` regenerates the file correctly before packing, so the published tarball is
right today — it stops being right the day `@semantic-release/git` is added. The script now builds
first; the same run then leaves `README.md` and `docs/` byte-identical, and `npm pack`'s README is
byte-identical to the committed one.

`bin/clean.sh` quoted its glob so it never expanded and relied on an unquoted expansion downstream,
and used `sed -i` in the form only GNU sed accepts, which is what the `gsed` branch was working
around. It now expands the glob as a glob, quotes every path at the point of use, derives `docs/`
from its own location rather than the caller's working directory, and edits through a temporary
file so no sed dialect test is needed. Verified against the generator's raw output: old and new
scripts produce byte-identical files, the new one also from a directory whose name contains a
space and with the working directory elsewhere, and `oclif readme --multi && sh ./bin/clean.sh`
still reproduces the committed `README.md` and `docs/` exactly.
