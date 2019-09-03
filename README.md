gsheet-cli
==========

A simple helper cli to interact with google sheets.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/gsheet-cli.svg)](https://npmjs.org/package/gsheet-cli)
[![Downloads/week](https://img.shields.io/npm/dw/gsheet-cli.svg)](https://npmjs.org/package/gsheet-cli)
[![License](https://img.shields.io/npm/l/gsheet-cli.svg)](https://github.com/jroehl/gsheet-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
* [TODO](#todo)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g gsheet-cli
$ gsheet COMMAND
running command...
$ gsheet (-v|--version|version)
gsheet-cli/0.0.0 darwin-x64 node-v10.16.0
$ gsheet --help [COMMAND]
USAGE
  $ gsheet COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`gsheet data:append DATA`](#gsheet-dataappend-data)
* [`gsheet data:get`](#gsheet-dataget)
* [`gsheet data:update DATA`](#gsheet-dataupdate-data)
* [`gsheet help [COMMAND]`](#gsheet-help-command)
* [`gsheet spreadsheet:add`](#gsheet-spreadsheetadd)
* [`gsheet spreadsheet:get`](#gsheet-spreadsheetget)
* [`gsheet worksheet:add`](#gsheet-worksheetadd)
* [`gsheet worksheet:get`](#gsheet-worksheetget)
* [`gsheet worksheet:remove`](#gsheet-worksheetremove)

## `gsheet data:append DATA`

Append cells with the specified data after the last row in starting col

```
USAGE
  $ gsheet data:append DATA

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

_See code: [src/commands/data/append.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/data/append.ts)_

## `gsheet data:get`

Returns cell data

```
USAGE
  $ gsheet data:get

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

_See code: [src/commands/data/get.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/data/get.ts)_

## `gsheet data:update DATA`

Updates cells with the specified data

```
USAGE
  $ gsheet data:update DATA

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

_See code: [src/commands/data/update.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/data/update.ts)_

## `gsheet help [COMMAND]`

display help for gsheet

```
USAGE
  $ gsheet help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v2.2.1/src/commands/help.ts)_

## `gsheet spreadsheet:add`

Add a worksheet with the specified title to the spreadsheet

```
USAGE
  $ gsheet spreadsheet:add

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  --spreadsheetTitle=spreadsheetTitle  (required) Title of the spreadsheet

EXAMPLE
  $ gsheet worksheet:add --spreadsheetTitle=<spreadsheetTitle>

  Spreadsheet "<spreadsheetTitle>" (<id>) successfully created > https://docs.google.com/spreadsheets/d/<id>/edit
```

_See code: [src/commands/spreadsheet/add.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/spreadsheet/add.ts)_

## `gsheet spreadsheet:get`

Get info for a specific spreadsheet

```
USAGE
  $ gsheet spreadsheet:get

OPTIONS
  -h, --help                         show CLI help
  -r, --rawOutput                    Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId  (required) ID of the spreadsheet to use

EXAMPLE
  $ gsheet spreadsheet:get --spreadsheetId=<spreadsheetId>

  Fetched "<spreadsheetTitle>" (<id>) > https://docs.google.com/spreadsheets/d/<id>/edit
```

_See code: [src/commands/spreadsheet/get.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/spreadsheet/get.ts)_

## `gsheet worksheet:add`

Add a worksheet with the specified title to the spreadsheet

```
USAGE
  $ gsheet worksheet:add

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use

EXAMPLE
  $ gsheet worksheet:add --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

  Worksheet "<worksheetTitle>" (<id>) successfully created
```

_See code: [src/commands/worksheet/add.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/worksheet/add.ts)_

## `gsheet worksheet:get`

Get info for a specific worksheet

```
USAGE
  $ gsheet worksheet:get

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use

EXAMPLE
  $ gsheet worksheet:get --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

  Fetched "<worksheetTitle>" (<id>)
```

_See code: [src/commands/worksheet/get.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/worksheet/get.ts)_

## `gsheet worksheet:remove`

Remove a worksheet with the specified title from the spreadsheet

```
USAGE
  $ gsheet worksheet:remove

OPTIONS
  -h, --help                           show CLI help
  -r, --rawOutput                      Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId    (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle  (required) Title of the worksheet to use

EXAMPLE
  $ gsheet worksheet:remove --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

  Worksheet "<worksheetTitle>" successfully removed
```

_See code: [src/commands/worksheet/remove.ts](https://github.com/jroehl/gsheet-cli/blob/v0.0.0/src/commands/worksheet/remove.ts)_
<!-- commandsstop -->


# TODO

- [ ] add prettier
