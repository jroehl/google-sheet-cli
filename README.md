google-sheet-cli
==========

A simple helper cli to interact with google sheets.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/google-sheet-cli.svg)](https://npmjs.org/package/google-sheet-cli)
[![Downloads/week](https://img.shields.io/npm/dw/google-sheet-cli.svg)](https://npmjs.org/package/google-sheet-cli)
[![License](https://img.shields.io/npm/l/google-sheet-cli.svg)](https://github.com/jroehl/google-sheet-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
* [TODO](#todo)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g google-sheet-cli
$ google-sheet COMMAND
running command...
$ google-sheet (-v|--version|version)
google-sheet-cli/0.0.0 darwin-x64 node-v10.16.0
$ google-sheet --help [COMMAND]
USAGE
  $ google-sheet COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`google-sheet data:append DATA`](#google-sheet-dataappend-data)
* [`google-sheet data:get`](#google-sheet-dataget)
* [`google-sheet data:update DATA`](#google-sheet-dataupdate-data)
* [`google-sheet help [COMMAND]`](#google-sheet-help-command)
* [`google-sheet spreadsheet:add`](#google-sheet-spreadsheetadd)
* [`google-sheet spreadsheet:get`](#google-sheet-spreadsheetget)
* [`google-sheet worksheet:add`](#google-sheet-worksheetadd)
* [`google-sheet worksheet:get`](#google-sheet-worksheetget)
* [`google-sheet worksheet:remove`](#google-sheet-worksheetremove)

## `google-sheet data:append DATA`

Append cells with the specified data after the last row in starting col

```
USAGE
  $ google-sheet data:append DATA

ARGUMENTS
  DATA  Specifies the data as nested array [["1", "2", "3"]]

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use
  --minCol=minCol                      [default: 1] The optional starting col of the operation

EXAMPLE
  $ gsheet data:append --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --data='[["1", "2", "3"]]'

  Data successfully appended to "<worksheetTitle>"
```

_See code: [src/commands/data/append.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/data/append.ts)_

## `google-sheet data:get`

Returns cell data

```
USAGE
  $ google-sheet data:get

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use
  -w, --hasHeaderRow                   If the first row should be treated as header row
  -x, --extended                       show extra columns
  --columns=columns                    only show provided columns (comma-separated)
  --csv                                output is csv format
  --filter=filter                      filter property by partial string matching, ex: name=foo
  --maxCol=maxCol                      The optional ending col of the operation
  --maxRow=maxRow                      The optional ending row of the operation
  --minCol=minCol                      [default: 1] The optional starting col of the operation
  --minRow=minRow                      [default: 1] The optional starting row of the operation
  --no-header                          hide table header from output
  --no-truncate                        do not truncate output to fit screen
  --range=range                        The range to use to query the cells
  --sort=sort                          property to sort by (prepend '-' for descending)

EXAMPLE
  $ gsheet data:get --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

  (a)  (b)  (c)
  A1   B1   C1
  A2   B2   C2
  A3   B3   C3
```

_See code: [src/commands/data/get.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/data/get.ts)_

## `google-sheet data:update DATA`

Updates cells with the specified data

```
USAGE
  $ google-sheet data:update DATA

ARGUMENTS
  DATA  specifies the data as nested array [["1", "2", "3"]]

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use
  --minCol=minCol                      [default: 1] the optional starting col of the operation
  --minRow=minRow                      [default: 1] the optional starting row of the operation

EXAMPLE
  $ gsheet data:update --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --data='[["1", "2", "3"]]'

  Data successfully updated in "<worksheetTitle>"
```

_See code: [src/commands/data/update.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/data/update.ts)_

## `google-sheet help [COMMAND]`

display help for google-sheet

```
USAGE
  $ google-sheet help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.1/src/commands/help.ts)_

## `google-sheet spreadsheet:add`

Add a worksheet with the specified title to the spreadsheet

```
USAGE
  $ google-sheet spreadsheet:add

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  --spreadsheetTitle=spreadsheetTitle  (required) Title of the spreadsheet

EXAMPLE
  $ gsheet worksheet:add --spreadsheetTitle=<spreadsheetTitle>

  Spreadsheet "<spreadsheetTitle>" (<id>) successfully created > https://docs.google.com/spreadsheets/d/<id>/edit
```

_See code: [src/commands/spreadsheet/add.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/spreadsheet/add.ts)_

## `google-sheet spreadsheet:get`

Get info for a specific spreadsheet

```
USAGE
  $ google-sheet spreadsheet:get

OPTIONS
  -h, --help                         show CLI help
  -r, --rawOutput                    Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId  (required) ID of the spreadsheet to use

EXAMPLE
  $ gsheet spreadsheet:get --spreadsheetId=<spreadsheetId>

  Fetched "<spreadsheetTitle>" (<id>) > https://docs.google.com/spreadsheets/d/<id>/edit
```

_See code: [src/commands/spreadsheet/get.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/spreadsheet/get.ts)_

## `google-sheet worksheet:add`

Add a worksheet with the specified title to the spreadsheet

```
USAGE
  $ google-sheet worksheet:add

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use

EXAMPLE
  $ gsheet worksheet:add --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

  Worksheet "<worksheetTitle>" (<id>) successfully created
```

_See code: [src/commands/worksheet/add.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/worksheet/add.ts)_

## `google-sheet worksheet:get`

Get info for a specific worksheet

```
USAGE
  $ google-sheet worksheet:get

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use

EXAMPLE
  $ gsheet worksheet:get --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

  Fetched "<worksheetTitle>" (<id>)
```

_See code: [src/commands/worksheet/get.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/worksheet/get.ts)_

## `google-sheet worksheet:remove`

Remove a worksheet with the specified title from the spreadsheet

```
USAGE
  $ google-sheet worksheet:remove

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use

EXAMPLE
  $ gsheet worksheet:remove --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

  Worksheet "<worksheetTitle>" successfully removed
```

_See code: [src/commands/worksheet/remove.ts](https://github.com/jroehl/google-sheet-cli/blob/v0.0.0/src/commands/worksheet/remove.ts)_
<!-- commandsstop -->


# TODO

- [ ] add prettier
