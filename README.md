# google-sheet-cli

A simple helper cli to interact with google sheets.

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
google-sheet-cli/0.0.0 darwin-arm64 node-v18.16.0
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
