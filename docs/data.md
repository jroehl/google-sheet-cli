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
  $ google-sheet data:append DATA

ARGUMENTS
  DATA  The data to be used as a JSON string - nested array [["1", "2", "3"]]

OPTIONS
  -h, --help                               show CLI help
  -r, --rawOutput                          Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId        (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle      (required) Title of the worksheet to use
  -v, --valueInputOption=valueInputOption  [default: RAW] The style of the input ("RAW" or "USER_ENTERED")
  --minCol=minCol                          [default: 1] The optional starting col of the operation

EXAMPLE
  $ gsheet data:append --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --data='[["1", "2", "3"]]'

  Data successfully appended to "<worksheetTitle>"
```

_See code: [src/commands/data/append.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/data/append.ts)_

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
  --csv                                output is csv format [alias: --output=csv]
  --filter=filter                      filter property by partial string matching, ex: name=foo
  --maxCol=maxCol                      The optional ending col of the operation
  --maxRow=maxRow                      The optional ending row of the operation
  --minCol=minCol                      [default: 1] The optional starting col of the operation
  --minRow=minRow                      [default: 1] The optional starting row of the operation
  --no-header                          hide table header from output
  --no-truncate                        do not truncate output to fit screen
  --output=csv|json|yaml               output in a more machine friendly format
  --range=range                        The range to use to query the cells
  --sort=sort                          property to sort by (prepend '-' for descending)

EXAMPLE
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
  $ google-sheet data:update DATA

ARGUMENTS
  DATA  The data to be used as a JSON string - nested array [["1", "2", "3"]]

OPTIONS
  -h, --help                               show CLI help
  -r, --rawOutput                          Get the raw output as a JSON string
  -s, --spreadsheetId=spreadsheetId        (required) ID of the spreadsheet to use
  -t, --worksheetTitle=worksheetTitle      (required) Title of the worksheet to use
  -v, --valueInputOption=valueInputOption  [default: RAW] The style of the input ("RAW" or "USER_ENTERED")
  --minCol=minCol                          [default: 1] The optional starting col of the operation
  --minRow=minRow                          [default: 1] The optional starting row of the operation

EXAMPLE
  $ gsheet data:update --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --data='[["1", "2", "3"]]'

  Data successfully updated in "<worksheetTitle>"
```

_See code: [src/commands/data/update.ts](https://github.com/jroehl/google-sheet-cli/blob/master/src/commands/data/update.ts)_
