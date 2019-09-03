declare module 'google-sheet' {
  class GoogleSpreadsheet {
    constructor(spreadsheetId: string);
  }

  interface SheetInfo {
    title: string;
    sheetId: number;
  }
  export interface SpreadsheetInfo {
    title: string;
    sheets: SheetInfo[];
    url: string;
  }
  interface Credentials {
    client_email: string;
    private_key: string;
  }

  type RawData = (string | number)[][];
  type Options = {
    ['min-col']?: number;
    ['max-col']?: number;
    ['min-row']?: number;
    ['max-row']?: number;
    ['return-empty']?: boolean;
  };
  class SpreadsheetWorksheet {
    url: string;
    id: string;
    title: string;
    getCells(options: Options): RawData;
    bulkUpdateCells(options: Options): RawData;
  }
}
