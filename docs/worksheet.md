`google-sheet worksheet`
========================

Manage worksheets

* [`google-sheet worksheet:add`](#google-sheet-worksheetadd)
* [`google-sheet worksheet:get`](#google-sheet-worksheetget)
* [`google-sheet worksheet:remove`](#google-sheet-worksheetremove)
* [`google-sheet worksheet:rename`](#google-sheet-worksheetrename)

## `google-sheet worksheet:add`

Add a worksheet with the specified title to the spreadsheet

```
USAGE
  $ google-sheet worksheet:add -t <value> -s <value> [-h] [-r] [-c <value>] [-p <value>]

FLAGS
  -h, --help                    Show CLI help.
  -r, --rawOutput               Get the raw output as a JSON string
  -s, --spreadsheetId=<value>   (required) ID of the spreadsheet to use
  -t, --worksheetTitle=<value>  (required) Title of the worksheet to use

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Add a worksheet with the specified title to the spreadsheet

EXAMPLES
  $ gsheet worksheet:add --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>
  Worksheet "<worksheetTitle>" (<id>) successfully created
```

_See code: [src/commands/worksheet/add.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/worksheet/add.ts)_

## `google-sheet worksheet:get`

Get info for a specific worksheet

```
USAGE
  $ google-sheet worksheet:get -t <value> -s <value> [-h] [-r] [-c <value>] [-p <value>]

FLAGS
  -h, --help                    Show CLI help.
  -r, --rawOutput               Get the raw output as a JSON string
  -s, --spreadsheetId=<value>   (required) ID of the spreadsheet to use
  -t, --worksheetTitle=<value>  (required) Title of the worksheet to use

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Get info for a specific worksheet

EXAMPLES
  $ gsheet worksheet:get --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>
  Fetched "<worksheetTitle>" (<id>)
```

_See code: [src/commands/worksheet/get.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/worksheet/get.ts)_

## `google-sheet worksheet:remove`

Remove a worksheet with the specified title from the spreadsheet

```
USAGE
  $ google-sheet worksheet:remove -t <value> -s <value> [-h] [-r] [-c <value>] [-p <value>]

FLAGS
  -h, --help                    Show CLI help.
  -r, --rawOutput               Get the raw output as a JSON string
  -s, --spreadsheetId=<value>   (required) ID of the spreadsheet to use
  -t, --worksheetTitle=<value>  (required) Title of the worksheet to use

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Remove a worksheet with the specified title from the spreadsheet

EXAMPLES
  $ gsheet worksheet:remove --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>
  Worksheet "<worksheetTitle>" successfully removed
```

_See code: [src/commands/worksheet/remove.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/worksheet/remove.ts)_

## `google-sheet worksheet:rename`

Add a worksheet with the specified title to the spreadsheet

```
USAGE
  $ google-sheet worksheet:rename -t <value> --newWorksheetTitle <value> -s <value> [-h] [-r] [-c <value>] [-p <value>]

FLAGS
  -h, --help                    Show CLI help.
  -r, --rawOutput               Get the raw output as a JSON string
  -s, --spreadsheetId=<value>   (required) ID of the spreadsheet to use
  -t, --worksheetTitle=<value>  (required) Title of the worksheet to use
  --newWorksheetTitle=<value>   (required) New title of the worksheet to use

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Add a worksheet with the specified title to the spreadsheet

EXAMPLES
  $ gsheet worksheet:rename --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --newWorksheetTitle=<newWorksheetTitle>
  Worksheet "<worksheetTitle>" successfully renamed to "<newWorksheetTitle>"
```

_See code: [src/commands/worksheet/rename.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/worksheet/rename.ts)_
