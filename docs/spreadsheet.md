`google-sheet spreadsheet`
==========================

Manage spreadsheets

* [`google-sheet spreadsheet:add`](#google-sheet-spreadsheetadd)
* [`google-sheet spreadsheet:get`](#google-sheet-spreadsheetget)

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

_See code: [src/commands/spreadsheet/add.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/spreadsheet/add.ts)_

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

_See code: [src/commands/spreadsheet/get.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/spreadsheet/get.ts)_
