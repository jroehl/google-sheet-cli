# google-sheet-cli

A simple helper cli to interact with google sheets.

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
