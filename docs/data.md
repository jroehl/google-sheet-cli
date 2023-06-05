`google-sheet data`
===================

Manage data in worksheet

* [`google-sheet data:append DATA`](#google-sheet-dataappend-data)
* [`google-sheet data:get`](#google-sheet-dataget)
* [`google-sheet data:update DATA`](#google-sheet-dataupdate-data)

## `google-sheet data:append DATA`

Append cells with the specified data after the last row in starting col

```
USAGE
  $ google-sheet data:append DATA -t <value> -s <value> [-h] [-r] [-c <value>] [-p <value>] [-v RAW|USER_ENTERED]
    [--minCol <value>]

ARGUMENTS
  DATA  The data to be used as a JSON string - nested array [["1", "2", "3"]]

FLAGS
  -h, --help                       Show CLI help.
  -r, --rawOutput                  Get the raw output as a JSON string
  -s, --spreadsheetId=<value>      (required) ID of the spreadsheet to use
  -t, --worksheetTitle=<value>     (required) Title of the worksheet to use
  -v, --valueInputOption=<option>  [default: RAW] The style of the input ("RAW" or "USER_ENTERED")
                                   <options: RAW|USER_ENTERED>
  --minCol=<value>                 [default: 1] The optional starting col of the operation

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Append cells with the specified data after the last row in starting col

EXAMPLES
  $ gsheet data:append --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --data='[["1", "2", "3"]]'
  Data successfully appended to "<worksheetTitle>"
```

_See code: [src/commands/data/append.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/data/append.ts)_

## `google-sheet data:get`

Returns cell data

```
USAGE
  $ google-sheet data:get -s <value> -t <value> [-h] [-r] [-c <value>] [-p <value>] [--columns <value> | -x]
    [--sort <value>] [--filter <value>] [--output csv|json|yaml |  | [--csv | --no-truncate]] [--no-header | ] [-w]
    [--range <value>] [--minRow <value>] [--minCol <value>] [--maxRow <value>] [--maxCol <value>]

FLAGS
  -h, --help                    Show CLI help.
  -r, --rawOutput               Get the raw output as a JSON string
  -s, --spreadsheetId=<value>   (required) ID of the spreadsheet to use
  -t, --worksheetTitle=<value>  (required) Title of the worksheet to use
  -w, --hasHeaderRow            If the first row should be treated as header row
  -x, --extended                show extra columns
  --columns=<value>             only show provided columns (comma-separated)
  --csv                         output is csv format [alias: --output=csv]
  --filter=<value>              filter property by partial string matching, ex: name=foo
  --maxCol=<value>              The optional ending col of the operation
  --maxRow=<value>              The optional ending row of the operation
  --minCol=<value>              [default: 1] The optional starting col of the operation
  --minRow=<value>              [default: 1] The optional starting row of the operation
  --no-header                   hide table header from output
  --no-truncate                 do not truncate output to fit screen
  --output=<option>             output in a more machine friendly format
                                <options: csv|json|yaml>
  --range=<value>               The range to use to query the cells
  --sort=<value>                property to sort by (prepend '-' for descending)

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Returns cell data

EXAMPLES
  $ gsheet data:get --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>
  (a)  (b)  (c)
  A1   B1   C1
  A2   B2   C2
  A3   B3   C3
```

_See code: [src/commands/data/get.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/data/get.ts)_

## `google-sheet data:update DATA`

Updates cells with the specified data

```
USAGE
  $ google-sheet data:update DATA -t <value> -s <value> [-h] [-r] [-c <value>] [-p <value>] [-v RAW|USER_ENTERED]
    [--minRow <value>] [--minCol <value>]

ARGUMENTS
  DATA  The data to be used as a JSON string - nested array [["1", "2", "3"]]

FLAGS
  -h, --help                       Show CLI help.
  -r, --rawOutput                  Get the raw output as a JSON string
  -s, --spreadsheetId=<value>      (required) ID of the spreadsheet to use
  -t, --worksheetTitle=<value>     (required) Title of the worksheet to use
  -v, --valueInputOption=<option>  [default: RAW] The style of the input ("RAW" or "USER_ENTERED")
                                   <options: RAW|USER_ENTERED>
  --minCol=<value>                 [default: 1] The optional starting col of the operation
  --minRow=<value>                 [default: 1] The optional starting row of the operation

AUTHENTICATION FLAGS
  -c, --clientEmail=<value>  The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if
                             not provided.
  -p, --privateKey=<value>   The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not
                             provided.

DESCRIPTION
  Updates cells with the specified data

EXAMPLES
  $ gsheet data:update --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> '[["1", "2", "3"]]'
  Data successfully updated in "<worksheetTitle>"
```

_See code: [src/commands/data/update.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/data/update.ts)_
