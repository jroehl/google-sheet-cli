`google-sheet worksheet`
========================

Manage worksheets

* [`google-sheet worksheet:add`](#google-sheet-worksheetadd)
* [`google-sheet worksheet:get`](#google-sheet-worksheetget)
* [`google-sheet worksheet:remove`](#google-sheet-worksheetremove)

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

_See code: [src/commands/worksheet/add.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/worksheet/add.ts)_

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

_See code: [src/commands/worksheet/get.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/worksheet/get.ts)_

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

_See code: [src/commands/worksheet/remove.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/worksheet/remove.ts)_
