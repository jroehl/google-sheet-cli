# google-sheet-cli

A simple helper cli to interact with google sheets.

## Migrating from 2.x

3.0.0 is a platform release. Every command, every flag and everything the commands print is the same as on 2.3.0, and the sequence of Sheets API calls each library method makes is unchanged — same requests, same order, same bodies. What moved is the Node floor, the module a library consumer imports, the type of the errors that are thrown, and one hostname the auth stack talks to.

Coming from 2.2.x rather than 2.3.0? 3.0.0 carries everything in [Changes in 2.3.0](#changes-in-230) as well, so read both. Two of those are outright behaviour changes and are repeated [at the end of this section](#two-22x-calls-that-changed-in-230).

Using the `jroehl/gsheet.action` GitHub Action rather than this package directly? It bundles a pinned copy of `google-sheet-cli` into its committed `dist/`, so none of this reaches a workflow until that action bumps the dependency and publishes.

### Node 22 or newer

`engines.node` is now `>=22`, so `google-sheet-cli@latest` needs Node 22 or newer. Node 14 through 20 are no longer supported.

The 2.x line stays on npm under the `v2` dist-tag and keeps its `>=14` floor:

```sh-session
$ npm install -g google-sheet-cli@v2
$ npx google-sheet-cli@v2 spreadsheet:get -s <spreadsheetId>
```

It is maintained on the `2.x` branch and gets fixes, not features.

### The bin scripts are `bin/run.js` and `bin/dev.js`

oclif 5 expects its executables to carry a file extension, so `bin/run` became `bin/run.js` and `bin/dev` became `bin/dev.js`. This only matters where something names the file by path — a checkout, a container image, a script calling `node_modules/google-sheet-cli/bin/run`. The installed `google-sheet` binary and `npx google-sheet-cli` are unaffected.

### A side-effect-free `google-sheet-cli/sheet` subpath

Using the library without the cli used to mean reaching into the build output:

```ts
import GoogleSheet from 'google-sheet-cli/lib/lib/google-sheet';
```

That path still works and still carries its types. 3.0.0 adds a declared one:

```ts
import GoogleSheet from 'google-sheet-cli/sheet';
```

The package root (`google-sheet-cli`) also exports oclif's `run`, so importing it loads the whole cli; `google-sheet-cli/sheet` loads the Sheets client and its auth chain and nothing else — 128 modules against 289 for the root, with no `@oclif/core` anywhere in the graph.

The subpath is declared through the package's `exports` map, so a TypeScript consumer has to be on `moduleResolution` `node16`, `nodenext` or `bundler`. Under the older `node10` resolution `google-sheet-cli/sheet` does not resolve at all (`TS2307: Cannot find module`), and only the deep path does. If moving that setting is not an option, keep the deep import.

### The `exports` map seals paths that used to be reachable

Declaring `exports` at all closes off everything it does not name. `google-sheet-cli`, `google-sheet-cli/sheet`, `google-sheet-cli/lib/*` (with or without `.js`) and `google-sheet-cli/package.json` resolve; anything else now fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The one path known to be closed this way is `google-sheet-cli/oclif.manifest.json`. Nothing in this project or its GitHub action reads it, but a consumer that did will have to stop.

### Errors are `Error` instances

Eight places used to `throw` a bare string. They now throw an `Error` carrying byte-identical text:

- `Spreadsheet "<id>" not found`
- `Sheet "<title>" not found in "<spreadsheet>"`
- `Option property "worksheetTitle" is required`
- `No header row exists`
- `Specify worksheetTitle`
- `Check "data" property - has to be supplied as nested array ([["1", "2"], ["3", "4"]])`
- `col has to be greater than 1`
- `Label has to be uppercase alphabet letter but is "<label>"`

The cli prints exactly what it printed before, and so does the GitHub action, which already read `err.message || err`. What breaks is a library consumer that compares the caught value to a string:

```ts
catch (err) {
  if (err === 'Specify worksheetTitle') { … }                     // 2.x, no longer matches
  if ((err as Error).message === 'Specify worksheetTitle') { … }  // 3.x
}
```

### The OAuth token endpoint and the scope moved

3.0.0 builds its Sheets client from `@googleapis/sheets` instead of the whole `googleapis` bundle. That brings a newer auth stack with it, and two things on the wire follow from it.

The token request goes to a different host, and the assertion asks for a different scope:

```
2.x   POST https://www.googleapis.com/oauth2/v4/token   scope https://spreadsheets.google.com/feeds/
3.x   POST https://oauth2.googleapis.com/token          scope https://www.googleapis.com/auth/spreadsheets
```

**If you run this behind an egress allowlist that names `www.googleapis.com`, add `oauth2.googleapis.com`.** `sheets.googleapis.com`, where every actual Sheets call goes, is unchanged, and so is every one of those calls.

The scope change needs no action for the normal setup: a service account that was shared onto a spreadsheet the way [Step 2](#step-2-sharing-the-spreadsheet) describes keeps working, because the sharing is what grants the access and the account authorises itself for the scope. **The exception is Google Workspace domain-wide delegation.** If the service account is used through delegation, an administrator has to add `https://www.googleapis.com/auth/spreadsheets` to that client's allowed scopes in the Admin console, beside the old feeds scope. Until they do, every call comes back 401.

### Request headers changed

Same upgrade, same cause — the HTTP client underneath went from gaxios 5 to gaxios 7. Google ignores all of this; it is listed because it is visible to a proxy, a request log or a strict middlebox.

On every Sheets call:

```
2.x   Accept: application/json
3.x   Accept: */*
```

On the token request:

```
2.x   Content-Type: application/x-www-form-urlencoded
      Accept-Encoding: gzip,deflate
3.x   Content-Type: application/x-www-form-urlencoded;charset=UTF-8
      Accept-Encoding: gzip, deflate, br
```

The `User-Agent` and `x-goog-api-client` version strings move with the client version, as they do on any upgrade.

### `help`'s argument is rendered differently

`@oclif/plugin-help` 7 declares the argument as a variadic, so the usage line and `docs/help.md` move from

```
$ google-sheet help [COMMANDS] [-n]
```

to

```
$ google-sheet help [COMMAND...] [-n]
```

Nothing about invoking it changes: `google-sheet help data:get` works exactly as before. The strings are named here because they are in the generated docs and in anyone's screenshots.

The same plugin also lays every command's `--help` out slightly differently: a flag that reads an environment variable is annotated `[env: NAME]`, a flag with no short character is indented under the ones that have one, and the dim styling on descriptions is gone. Every flag itself — long name, short character, default, `=<value>` shape — is unchanged. If something parses `--help` output, this is the release that will break it.

### `js-yaml` is pinned to 3.x on purpose

`data:get --output=yaml` is rendered by a copy of `@oclif/core@2.8.11`'s table, carried in `src/lib/table.ts` because core 5 has no `ux.table` and no successor that keeps the eight table flags. That code calls `safeDump`, which js-yaml 4 renamed to `dump`. The pin exists so the yaml output stays byte-for-byte what 2.2.x emitted, which is the property the whole vendored table was verified against. js-yaml 3.14.1 is end of life; this is a deliberate compatibility pin, not neglect, and moving it means re-running that output comparison, not just changing the version.

### Two 2.2.x calls that changed in 2.3.0

These arrived in 2.3.0, not in 3.0.0, so they are new only to someone upgrading from 2.2.x. Both were found by running the published 2.2.0 build and this one side by side over 62 call shapes; those two are the only differences.

**A range that names no worksheet, together with a `worksheetTitle` that does not exist, now fails.** `updateData(data, { worksheetTitle: 'Ghost', range: 'A1:B1' })` handed `A1:B1` to the API on 2.2.0, which resolved it against the first sheet and wrote there. Now the grid-sizing step looks the worksheet up first, does not find it, and throws. It needs both halves — a range carrying no worksheet, and a title naming a sheet that is gone. The cli cannot reach it (no write command exposes a `range` flag); only the library and the GitHub action's `range` option can.

**`appendData` no longer writes the range's worksheet back onto the options object you passed.** With a quoted range and an explicit title, 2.2.0 left your `worksheetTitle` mutated to the range's worksheet; it is now left as you passed it. The data lands in the same cells either way. It is visible through the GitHub action, which serialises `command.kwargs` into its `results` output, so a workflow reading `kwargs[1].worksheetTitle` after such a call sees a different value.

### What has not changed

- Every command, flag, short character, default and argument. `data:get`'s eight table flags (`--columns`, `--sort`, `--filter`, `--csv`, `--output`, `-x/--extended`, `--no-truncate`, `--no-header`) all survive, rendering the same table.
- The Sheets requests each library method makes, down to the query string and the body.
- Authentication itself: service accounts, the same three ways of handing over credentials, the same `GSHEET_*` environment variables.
- A `range` that names a different worksheet than `worksheetTitle` still warns on stderr and writes to the worksheet the range names, exactly as 2.2.x and 2.3.0 do.

## Changes in 2.3.0

- The `engines.node` floor is now `>=14`, which was always the real minimum.
- Unusable service account credentials are rejected before the first request, with a message that names the fix instead of an OpenSSL parser error.
- The new `--credentialsFile` flag reads the credentials straight out of the service account JSON file. See [Credentials](#credentials).
- Writing past the last row or column of a worksheet now grows the grid first instead of failing with "exceeds grid limits", so appending to a sheet that is already full works again.
- A `range` naming a different worksheet than `worksheetTitle` still writes to the worksheet the range names, exactly as 2.2.x did, but now says so on stderr instead of resolving the contradiction silently. Refusing the call outright is held for 3.0.0.
- `updateData` now accepts a `range` carrying a quoted worksheet title with no `worksheetTitle` beside it, taking the worksheet from the range instead of insisting on a title the range already named. As in 2.2.x, an unquoted title inside a range does not name the worksheet.
- A write now re-points the worksheet a `GoogleSheet` instance remembers. `updateData` resolves and fetches its target worksheet before writing, and that worksheet becomes the one a later command uses when it omits `worksheetTitle`. Before 2.3.0 only a read moved it. This is only visible when several commands share one instance, which is what the GitHub action does.
- A write that sizes a grid costs one extra API read. Growing the grid means knowing how big it is, so `updateData` fetches the spreadsheet before the update, plus one more request when the grid actually has to grow. The one write that reads nothing extra is an unquoted `range` naming a worksheet other than the one the call resolves to, where nothing is sized because nothing there is written to.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/google-sheet-cli.svg)](https://npmjs.org/package/google-sheet-cli)
[![Downloads/week](https://img.shields.io/npm/dw/google-sheet-cli.svg)](https://npmjs.org/package/google-sheet-cli)
[![License](https://img.shields.io/npm/l/google-sheet-cli.svg)](https://github.com/jroehl/google-sheet-cli/blob/master/package.json)

[![CodeQL](https://github.com/jroehl/google-sheet-cli/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/jroehl/google-sheet-cli/actions/workflows/codeql-analysis.yml)
[![Test version](https://github.com/jroehl/google-sheet-cli/actions/workflows/test.yml/badge.svg)](https://github.com/jroehl/google-sheet-cli/actions/workflows/test.yml)

- [google-sheet-cli](#google-sheet-cli)
  - [Migrating from 2.x](#migrating-from-2x)
  - [Changes in 2.3.0](#changes-in-230)
  - [Usage as CLI](#usage-as-cli)
  - [Usage as library](#usage-as-library)
- [Command Topics](#command-topics)
- [Info](#info)
  - [How to configure](#how-to-configure)
    - [Step 1: Setting Up Google Service Account](#step-1-setting-up-google-service-account)
    - [Step 2: Sharing the Spreadsheet](#step-2-sharing-the-spreadsheet)
  - [Credentials](#credentials)
  - [Build with](#build-with)
  - [Contributing](#contributing)
  - [Versioning](#versioning)
  - [License](#license)
  - [TODO](#todo)

## Usage as CLI
<!-- usage -->
```sh-session
$ npm install -g google-sheet-cli
$ google-sheet COMMAND
running command...
$ google-sheet (--version)
google-sheet-cli/0.0.0 darwin-arm64 node-v24.11.1
$ google-sheet --help [COMMAND]
USAGE
  $ google-sheet COMMAND
...
```
<!-- usagestop -->

## Usage as library

You can import the GoogleSheet class as a module and use it without the cli functionality.
_See code: [src/lib/google-sheet.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/lib/google-sheet.ts)_

<!-- commands -->
# Command Topics

* [`google-sheet data`](docs/data.md) - Manage data in worksheet
* [`google-sheet help`](docs/help.md) - Display help for google-sheet.
* [`google-sheet spreadsheet`](docs/spreadsheet.md) - Manage spreadsheets
* [`google-sheet worksheet`](docs/worksheet.md) - Manage worksheets

<!-- commandsstop -->

# Info

## How to configure

### Step 1: Setting Up Google Service Account

1. Login to Google API Console: Visit the Google Cloud Console website (https://console.cloud.google.com/) and log in using your Google account credentials.
2. Enable Google Sheets API: In the Google Cloud Console, navigate to the "Library" section. Here, search for "Google Sheets API" and enable it.
3. Create a Service Account: Next, go to the "Credentials" section. Here, click on the "Create Credentials" dropdown button and select "Service Account". There's no need to assign any special role to this service account. Simply follow the prompts to create the account.
4. Download Credentials: Once the service account is created, a JSON file containing the credentials of the service account will be automatically generated. Download this file and keep it safe. You will need the `client_email` and `private_key` from this file to setup the Google Sheets Action.

### Step 2: Sharing the Spreadsheet

1. Share Spreadsheet: Go to the Google Spreadsheet that you want to use with this action. Click on the "Share" button (usually at the top right corner) and in the sharing settings, add the `client_email` (that you got from the downloaded JSON file) with read permissions.
2. Get Document ID: The document ID is the string of random characters in the URL of your Google Spreadsheet, found between '/d/' and '/edit'. Keep this document ID handy.

## Credentials

Every command authenticates as the service account from Step 1, using the `client_email` and the `private_key` of the downloaded JSON file. There are three ways to hand them over:

1. **The JSON file** - `--credentialsFile=<path>` (`-f`), or the `GSHEET_CREDENTIALS_FILE` env variable.
2. **The two values** - `--clientEmail=<value>` (`-c`) and `--privateKey=<value>` (`-p`), or the `GSHEET_CLIENT_EMAIL` and `GSHEET_PRIVATE_KEY` env variables.
3. **Neither** - the cli prompts for what is missing.

They can be mixed, because precedence is field by field: `--clientEmail` and `--privateKey` win over the same field in the credentials file, the file fills in whatever they left out, and only what is still missing is prompted for.

```sh-session
$ google-sheet spreadsheet:get -s <spreadsheetId> -f ./service-account.json
```

The `private_key` is the whole PEM block from the JSON file, `BEGIN` and `END` lines included:

```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ...
-----END PRIVATE KEY-----
```

Escaped newlines (`\n`) and surrounding quotes are taken care of, so the value can be pasted straight out of the JSON file or out of a CI secret. A key converted to the older `BEGIN RSA PRIVATE KEY` (PKCS#1) form is accepted as well. Note that the `private_key_id` is a different field and will not work. A key that is truncated or damaged is rejected before any request is made; run with `DEBUG=gsheet:credentials` to see the parser error behind the rejection.

For anything scripted, hand the key over with `--credentialsFile` or the environment variables rather than piping it into the prompt. The prompt strips backslashes when its input is not a terminal, which turns the escaped newlines into stray `n` characters and makes a perfectly good key look broken.

## Build with

- [googleapis](https://github.com/googleapis/googleapis) - The node module used for manipulating the google sheet
- [oclif](https://oclif.io) - The node module used to create the cli
- [semantic-release](https://github.com/semantic-release/semantic-release) - for releasing new versions
- [typescript](https://www.typescriptlang.org)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/your/project/tags).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## TODO

- [x] documentation
- [ ] more tests
- [ ] add prettier
