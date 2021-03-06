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
$ google-sheet (-v|--version|version)
google-sheet-cli/0.0.0 darwin-x64 node-v14.15.5
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
* [`google-sheet help`](docs/help.md) - display help for google-sheet
* [`google-sheet spreadsheet`](docs/spreadsheet.md) - Manage spreadsheets
* [`google-sheet worksheet`](docs/worksheet.md) - Manage worksheets

<!-- commandsstop -->

# Info

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
