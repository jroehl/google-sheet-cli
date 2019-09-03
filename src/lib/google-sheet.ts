import { google, sheets_v4 } from 'googleapis';
import get from 'lodash.get';
import { colToA, getRange, getLongestArray, parseRanges } from './utils';

export interface Credentials {
  client_email: string;
  private_key: string;
}

type RawData = (string | number | boolean | null)[][];

enum ValueInputOption {
  INPUT_VALUE_OPTION_UNSPECIFIED = 'INPUT_VALUE_OPTION_UNSPECIFIED',
  USER_ENTERED = 'USER_ENTERED',
  RAW = 'RAW',
}

export interface QueryOptions {
  minCol?: number;
  maxCol?: number;
  minRow?: number;
  maxRow?: number;
  range?: string;
  valueInputOption?: ValueInputOption;
  worksheetTitle?: string;
  returnEmpty?: boolean;
  hasHeaderRow?: boolean;
}

export interface FormattedData {
  [name: string]: string;
}

export interface SheetData {
  rawData: RawData;
  formatted: FormattedData[];
  header: string[];
  range: string;
}

const GOOGLE_FEED_URL = 'https://spreadsheets.google.com/feeds/';

/**
 * GoogleSheet helper class for CRUD operations
 *
 * @export
 * @class GoogleSheet
 */
export default class GoogleSheet {
  private sheets!: sheets_v4.Sheets;
  private worksheetTitle: string = '';

  /**
   * Creates an instance of GoogleSheet.
   * @param {string} [spreadsheetId]
   * @memberof GoogleSheet
   */
  constructor(private spreadsheetId?: string) {}

  /**
   * Authorize with credentials
   *
   * @param {Credentials} credentials
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async authorize(credentials: Credentials): Promise<void> {
    credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    // Create the JWT client
    const auth = await google.auth.getClient({ credentials, scopes: [GOOGLE_FEED_URL] });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Get information about the spreadsheet.
   *
   * @param {string} [spreadsheetId]
   * @returns {Promise<sheets_v4.Schema$Spreadsheet>}
   * @memberof GoogleSheet
   */
  async getSpreadsheet(spreadsheetId?: string): Promise<sheets_v4.Schema$Spreadsheet> {
    const { data: sheet } = await this.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
    });
    if (!sheet) throw `Spreadsheet "${spreadsheetId || this.spreadsheetId}" not found`;
    return sheet;
  }

  /**
   * Get information about the worksheet.
   *
   * @param {string} title
   * @param {string} [spreadsheetId]
   * @returns {Promise<sheets_v4.Schema$Sheet>}
   * @memberof GoogleSheet
   */
  async getWorksheet(title: string, spreadsheetId?: string): Promise<sheets_v4.Schema$Sheet> {
    const { sheets = [], properties: { title: ssTitle = '' } = {} } = await this.getSpreadsheet(spreadsheetId);

    const sheet = sheets.find(({ properties: { title: ws } = {} }) => ws === title);
    if (!sheet) throw `Sheet "${title}" not found in "${ssTitle}"`;

    this.worksheetTitle = get(sheet, 'properties.title');
    return sheet;
  }

  /**
   * Get the data of the specified cells (or every available cell data)
   *
   * @param {QueryOptions} [options={}]
   * @param {string} [spreadsheetId]
   * @returns {Promise<SheetData>}
   * @memberof GoogleSheet
   */
  async getData(options: QueryOptions = {}, spreadsheetId?: string): Promise<SheetData> {
    options.worksheetTitle = options.worksheetTitle || this.worksheetTitle;
    const parsedOptions = parseRanges(options)[0];
    const { worksheetTitle: wsTitle } = parsedOptions;
    if (!wsTitle) {
      throw 'Option property "worksheetTitle" is required';
    }

    const sheet = await this.getWorksheet(wsTitle, spreadsheetId);
    const { rowCount = 0, columnCount = 0 } = sheet && sheet.properties && sheet.properties.gridProperties ? sheet.properties.gridProperties : {};

    const sanitizedOptions: QueryOptions = {
      ...parsedOptions,
      maxCol: parsedOptions.maxCol || columnCount,
      maxRow: parsedOptions.maxRow || rowCount,
    };

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      range: getRange(sanitizedOptions),
    });

    const range = get(res, 'data.range');
    let values = get(res, 'data.values');

    let header: string[] = [];
    if (sanitizedOptions.hasHeaderRow) {
      if (!sanitizedOptions.minRow || sanitizedOptions.minRow <= 1) {
        [header, ...values] = values;
      } else {
        const res = await this.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId || this.spreadsheetId,
          range: getRange({
            ...sanitizedOptions,
            worksheetTitle: wsTitle,
            minRow: 1,
            maxRow: 1,
            range: undefined,
          }),
        });
        [header] = get(res, 'data.values', [[]]);
        if (!header.length) throw 'No header row exists';
      }
    }

    let maxCol = (sanitizedOptions.maxCol ? sanitizedOptions.maxCol + 1 : 0) - (sanitizedOptions.minCol || 0);
    let maxRow = 0;
    if (values) {
      maxCol = getLongestArray(values).length;
      maxRow = values.length;
    }

    // fill missing headings
    for (let c = 0; c < maxCol; c++) {
      header[c] = header[c] || `(${colToA(c + (sanitizedOptions.minCol || 0))})`;
    }

    let formatted: FormattedData[] = [];
    let rawData: RawData = [];
    for (let r = 0; r < maxRow; r++) {
      const row = values[r] || [];
      const rawRow = [];
      let set = {};
      for (let c = 0; c < maxCol; c++) {
        const heading = header[c];
        const cell = row[c] || '';
        rawRow[c] = cell;
        set = { ...set, [heading]: cell };
      }
      formatted = [...formatted, set];
      rawData = [...rawData, rawRow];
    }

    return { rawData, formatted, header, range };
  }

  /**
   * Append row data to a worksheet, starting after the last row in a specific column
   *
   * @param {RawData} data
   * @param {QueryOptions} options
   * @param {string} [spreadsheetId]
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async appendData(data: RawData, options: QueryOptions, spreadsheetId?: string): Promise<void> {
    const { rawData }: SheetData = await this.getData(options, spreadsheetId);
    options.minRow = rawData.length + 1;
    await this.updateData(data, options, spreadsheetId);
  }

  /**
   * Update the data starting at a specific row and column
   *
   * @param {RawData} data [['A1', 'A2', 'A3', 'A4', 'A5'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']]
   * @param {QueryOptions} options
   * @param {string} [spreadsheetId]
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async updateData(data: RawData, options: QueryOptions, spreadsheetId?: string): Promise<void> {
    options.worksheetTitle = options.worksheetTitle || this.worksheetTitle;
    if (!options.worksheetTitle) throw 'Specify worksheetTitle';
    if (!Array.isArray(data) || !data.every(Array.isArray)) throw 'Check "data" property - has to be supplied as nested array ([["1", "2"], ["3", "4"]])';

    const range = getRange(options);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      valueInputOption: options.valueInputOption || ValueInputOption.RAW,
      range,
      requestBody: {
        values: data,
      },
    });
  }

  /**
   * Add a worksheet with title
   *
   * @param {string} title
   * @param {string} [spreadsheetId]
   * @returns {Promise<sheets_v4.Schema$Sheet>}
   * @memberof GoogleSheet
   */
  async addWorksheet(title: string, spreadsheetId?: string): Promise<sheets_v4.Schema$Sheet> {
    const response = await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title,
              },
            },
          },
        ],
      },
    });
    const sheet = get(response, 'data.replies[0].addSheet');
    this.worksheetTitle = get(sheet, 'properties.title');
    return sheet;
  }

  /**
   * Remove a worksheet by title
   *
   * @param {string} title
   * @param {string} [spreadsheetId]
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async removeWorksheet(title: string, spreadsheetId?: string): Promise<void> {
    const sheet = await this.getWorksheet(title, spreadsheetId);
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId: sheet.properties && sheet.properties.sheetId ? sheet.properties.sheetId : -1,
            },
          },
        ],
      },
    });
    this.worksheetTitle = '';
  }

  /**
   * Add a spreadsheet with title
   *
   * @param {string} title
   * @returns {Promise<sheets_v4.Schema$Spreadsheet>}
   * @memberof GoogleSheet
   */
  async addSpreadsheet(title: string): Promise<sheets_v4.Schema$Spreadsheet> {
    const { data: sheet } = await this.sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title,
        },
      },
    });
    this.spreadsheetId = sheet.spreadsheetId;
    return sheet;
  }
}
