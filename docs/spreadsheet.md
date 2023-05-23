`google-sheet spreadsheet`
==========================

Manage spreadsheets

* [`google-sheet spreadsheet:add`](#google-sheet-spreadsheetadd)
* [`google-sheet spreadsheet:get`](#google-sheet-spreadsheetget)

## `google-sheet spreadsheet:add`

Add a worksheet with the specified title to the spreadsheet

```
USAGE
  $ google-sheet spreadsheet:add --spreadsheetTitle <value> [-h] [-r] [-c <value>] [-p <value>]

FLAGS
  -h, --help                  Show CLI help.
  -r, --rawOutput             Get the raw output as a JSON string
  --spreadsheetTitle=<value>  (required) Title of the spreadsheet

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Add a worksheet with the specified title to the spreadsheet

EXAMPLES
  $ gsheet worksheet:add --spreadsheetTitle=<spreadsheetTitle>
  Spreadsheet "<spreadsheetTitle>" (<id>) successfully created > https://docs.google.com/spreadsheets/d/<id>/edit
```

_See code: [src/commands/spreadsheet/add.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/spreadsheet/add.ts)_

## `google-sheet spreadsheet:get`

Get info for a specific spreadsheet

```
USAGE
  $ google-sheet spreadsheet:get -s <value> [-h] [-r] [-c <value>] [-p <value>]

FLAGS
  -h, --help                   Show CLI help.
  -r, --rawOutput              Get the raw output as a JSON string
  -s, --spreadsheetId=<value>  (required) ID of the spreadsheet to use

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Get info for a specific spreadsheet

EXAMPLES
  $ gsheet spreadsheet:get --spreadsheetId=<spreadsheetId>
  Fetched "<spreadsheetTitle>" (<id>) > https://docs.google.com/spreadsheets/d/<id>/edit
```

_See code: [src/commands/spreadsheet/get.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/spreadsheet/get.ts)_
