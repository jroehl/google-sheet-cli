import { auth, sheets, sheets_v4 } from '@googleapis/sheets';
import { CredentialsInput, normalizeCredentials } from './credentials';
import { log } from './log';
import { colToA, getLongestArray, getRange, parseRange, rangeWorksheet, requiredGrid } from './utils';

export namespace GoogleSheetCli {
  export interface Credentials {
    client_email: string;
    private_key: string;
  }

  export type RawData = (string | number | boolean | null)[][];

  export enum ValueInputOption {
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
    worksheetTitle?: string | null;
    hasHeaderRow?: boolean;
  }

  export interface FormattedData {
    [name: string]: string;
  }

  export interface SheetData {
    rawData: RawData;
    formatted: FormattedData[];
    header: string[];
    range?: string | null;
  }
}

// The Sheets API scope. 2.x asked for the retired Sheets v3 feed scope, which Google still
// accepted for v4 calls; this is the scope the v4 API actually documents, and it covers every
// call this class makes, `spreadsheets.create` included. Service account JWTs carry their scope
// in the assertion rather than in a consent screen, so nothing has to be re-granted.
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const LOG_NAMESPACE = 'gsheet:sheets';

/**
 * Say on stderr why a call did nothing. Not gated behind DEBUG, unlike the credentials
 * output: a silent no-op is the thing worth warning about, so the caller has to see it
 * without knowing to ask.
 */
const warn = (message: string): void => log(LOG_NAMESPACE, message);

/**
 * GoogleSheet helper class for CRUD operations
 *
 * @export
 * @class GoogleSheet
 */
export default class GoogleSheet {
  private sheets!: sheets_v4.Sheets;

  /**
   * Creates an instance of GoogleSheet.
   * @param {string} [spreadsheetId]
   * @param {string} [worksheetTitle]
   * @memberof GoogleSheet
   */
  constructor(private spreadsheetId?: string, private worksheetTitle?: string | null) {}

  /**
   * Authorize with credentials, either passed directly or read from a service account JSON file
   *
   * @param {CredentialsInput} credentials
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async authorize(credentials: CredentialsInput): Promise<void> {
    const { client_email, private_key } = normalizeCredentials(credentials);
    if (!client_email) throw new Error('client_email is required to authorize');
    if (!private_key) throw new Error('private_key is required to authorize');
    // Create the JWT client
    const client = new auth.JWT({ email: client_email, key: private_key, scopes: [SHEETS_SCOPE] });
    this.sheets = sheets({ version: 'v4', auth: client });
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

    if (!sheet) throw new Error(`Spreadsheet "${spreadsheetId || this.spreadsheetId}" not found`);
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
    if (!sheet) throw new Error(`Sheet "${title}" not found in "${ssTitle}"`);

    this.worksheetTitle = sheet?.properties?.title;
    return sheet;
  }

  /**
   * Get the data of the specified cells (or every available cell data)
   *
   * @param {GoogleSheetCli.QueryOptions} [options={}]
   * @param {string} [spreadsheetId]
   * @returns {Promise<GoogleSheetCli.SheetData>}
   * @memberof GoogleSheet
   */
  async getData(options: GoogleSheetCli.QueryOptions = {}, spreadsheetId?: string): Promise<GoogleSheetCli.SheetData> {
    options.worksheetTitle = options.worksheetTitle || this.worksheetTitle;
    if (options.range) {
      const parsedOptions = parseRange(options.range);
      // A quoted title inside the range overwrites worksheetTitle; an unquoted one does not.
      // That is not a preference, it is what 2.2.0 did - its regex only ever recognised the
      // quoted form - and the choice is remembered on the instance, so it steers every later
      // command in the run as well. Both halves have to stay.
      if (parsedOptions.worksheetTitle && rangeWorksheet(options.range).quoted) {
        options.worksheetTitle = parsedOptions.worksheetTitle;
      }
      if (parsedOptions.minCol) {
        options.minCol = parsedOptions.minCol;
      }
      if (parsedOptions.maxCol) {
        options.maxCol = parsedOptions.maxCol;
      }
      if (parsedOptions.minRow) {
        options.minRow = parsedOptions.minRow;
      }
      if (parsedOptions.maxRow) {
        options.maxRow = parsedOptions.maxRow;
      }
    }

    if (!options.worksheetTitle) {
      throw new Error('Option property "worksheetTitle" is required');
    }

    const sheet = await this.getWorksheet(options.worksheetTitle, spreadsheetId);
    const { rowCount = 0, columnCount = 0 } = sheet?.properties?.gridProperties || {};

    const sanitizedOptions: GoogleSheetCli.QueryOptions = {
      ...options,
      maxCol: options.maxCol || columnCount || 0,
      maxRow: options.maxRow || rowCount || 0,
    };

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      range: getRange(sanitizedOptions),
    });

    const range = res.data.range;
    let values = res.data.values;

    let header: string[] = [];
    if (sanitizedOptions.hasHeaderRow) {
      if (!sanitizedOptions.minRow || sanitizedOptions.minRow <= 1) {
        [header, ...values] = values || [];
      } else {
        const res = await this.sheets.spreadsheets.values.get({
          spreadsheetId: spreadsheetId || this.spreadsheetId,
          range: getRange({
            ...sanitizedOptions,
            worksheetTitle: options.worksheetTitle,
            minRow: 1,
            maxRow: 1,
            range: undefined,
          }),
        });
        [header] = res.data.values ?? [[]];
        if (!header.length) throw new Error('No header row exists');
      }
    }

    // Where the generated `(A)`, `(B)` labels below start counting, and how many of them there
    // are. With an explicit minCol it is minCol, as it always was. With minCol absent it depends
    // on whether 2.2.x got this far at all, and the two cases are deliberately different.
    //
    // 2.2.x used 0 here. `colToA` refuses anything below 1, and the loop below only calls it for
    // a blank heading, so `colToA(0)` was reached exactly when minCol was absent *and* header[0]
    // was falsy - and only at c === 0, because for c >= 1 the argument was already at least 1.
    // That splits every call into two populations that cannot overlap, since one call has one
    // header[0]:
    //
    //   header[0] present -> 2.2.x returned a result. Its generated labels were wrong: with
    //                        origin 0 it named column B "(A)" and column D "(C)", one column to
    //                        the left of the cell each label sits over, and the same arithmetic
    //                        emitted one label too many when the read returned no rows. Those
    //                        wrong labels are the keys of the `formatted` objects, and the
    //                        GitHub action serialises them into its `results` output, so a
    //                        workflow may be reading them today. They are kept. Do not "fix"
    //                        them here: correcting them is a change to output that currently
    //                        works, which belongs in a release that announces it.
    //   header[0] absent  -> 2.2.x threw `col has to be greater than 1` and returned nothing.
    //                        Nothing can depend on a throw, so this is the one place free to use
    //                        the origin the range actually has: `getRange` reads from
    //                        `colToA(minCol || 1)`, so column 1 it is.
    //
    // The asymmetry is the point. It preserves everything that worked and unblocks everything
    // that did not, and it is measured against published 2.2.0 in test-docs/revive-v3.md.
    const returnedOn22x = Boolean(header && header[0]);
    const labelOrigin = sanitizedOptions.minCol || (returnedOn22x ? 0 : 1);

    let maxCol = (sanitizedOptions.maxCol ? sanitizedOptions.maxCol + 1 : 0) - labelOrigin;
    let maxRow = 0;
    if (values) {
      maxCol = getLongestArray(values).length;
      maxRow = values.length;
    }

    // fill missing headings
    for (let c = 0; c < maxCol; c++) {
      header[c] = header[c] || `(${colToA(c + labelOrigin)})`;
    }

    let formatted: GoogleSheetCli.FormattedData[] = [];
    let rawData: GoogleSheetCli.RawData = [];
    for (let r = 0; r < maxRow; r++) {
      const row = values?.[r] || [];
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
   * @param {GoogleSheetCli.RawData} data
   * @param {GoogleSheetCli.QueryOptions} options
   * @param {string} [spreadsheetId]
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async appendData(data: GoogleSheetCli.RawData, options: GoogleSheetCli.QueryOptions, spreadsheetId?: string): Promise<void> {
    // `getData` fills `worksheetTitle` in on the object it is handed, from the range or from the
    // title remembered on the instance. Hand it a copy: `updateData` has to see the title the
    // caller passed to *this* call, or its absence, not one an earlier command left behind.
    // Only `minRow` is written back, because callers (and the action's e2e) read it there.
    const { rawData }: GoogleSheetCli.SheetData = await this.getData({ ...options }, spreadsheetId);
    options.minRow = rawData.length + 1;
    await this.updateData(data, options, spreadsheetId);
  }

  /**
   * Update the data starting at a specific row and column
   *
   * @param {GoogleSheetCli.RawData} data [['A1', 'A2', 'A3', 'A4', 'A5'], ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']]
   * @param {GoogleSheetCli.QueryOptions} options
   * @param {string} [spreadsheetId]
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async updateData(data: GoogleSheetCli.RawData, options: GoogleSheetCli.QueryOptions, spreadsheetId?: string): Promise<void> {
    // what the caller actually named, before the remembered title fills the gap. Only a title
    // the caller passed can contradict a range; a title left over from an earlier command on
    // the same instance is not something they said here.
    const namedTitle = options.worksheetTitle;
    options.worksheetTitle = options.worksheetTitle || this.worksheetTitle;

    // Which worksheet this call resolves to follows getData: a quoted title inside the range
    // wins, an unquoted one does not, because that is what 2.2.0 did.
    const { worksheetTitle: rangeTitle, quoted } = options.range ? rangeWorksheet(options.range) : { worksheetTitle: undefined, quoted: false };

    // A caller who names one worksheet and a range naming another has said two contradictory
    // things, whichever way the range spelled it. 2.2.0 resolved that silently in the range's
    // favour, because getRange hands the range to the API untouched, and a fix release may not
    // turn a call that worked into a failure. So: say which one wins, then do what 2.2.0 did.
    // 3.0.0 keeps the warning rather than turning it into a refusal: a refusal would break a
    // call every 2.x release completed, and every other break in that major is a platform
    // move. See test-docs/revive-v3.md for the decision.
    const contradicted = Boolean(rangeTitle && namedTitle && rangeTitle !== namedTitle);
    if (contradicted) {
      warn(`range "${options.range}" targets worksheet "${rangeTitle}" but worksheetTitle is "${namedTitle}"; writing to "${rangeTitle}", as 2.2.x did`);
    }

    // The range's worksheet is where the write lands whenever it won, so it is also the one to
    // resolve and to grow. Growing the other one would add rows to a sheet nobody wrote to.
    const targetTitle = (quoted || contradicted ? rangeTitle : undefined) || options.worksheetTitle;
    if (!targetTitle) throw new Error('Specify worksheetTitle');
    if (!Array.isArray(data) || !data.every(Array.isArray)) {
      throw new Error('Check "data" property - has to be supplied as nested array ([["1", "2"], ["3", "4"]])');
    }
    // A job that writes "whatever came in today" and finds nothing succeeded on every quiet day
    // before 2.3.0, so an empty array stays a success. It just no longer costs a request.
    if (!data.length) {
      warn('no rows to write, nothing was sent to the spreadsheet');
      return;
    }

    const { rows, cols } = requiredGrid(data, options);
    // Only size a grid the write is going to land in, and only read the one being sized. With an
    // unquoted range and no explicit title the call resolves to the remembered worksheet while
    // getRange sends the write to the range's, so growing here would add rows to a sheet nobody
    // asked about - and fetching it would fail a write that 2.2.0 completed, whenever the
    // remembered title has since been renamed away.
    if (!rangeTitle || rangeTitle === targetTitle) {
      const sheet = await this.getWorksheet(targetTitle, spreadsheetId);
      await this.ensureGridSize(sheet, rows, cols, spreadsheetId);
    }

    const range = getRange(options);
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      valueInputOption: options.valueInputOption || GoogleSheetCli.ValueInputOption.RAW,
      range,
      requestBody: {
        values: data,
      },
    });
  }

  /**
   * Grow the worksheet grid so that it holds at least the requested number of rows and columns.
   * The API never grows the grid for a values.update, so a write past the last row or column
   * fails with "exceeds grid limits" unless the dimensions are appended first (#611).
   *
   * @param {sheets_v4.Schema$Sheet} sheet
   * @param {number} neededRows
   * @param {number} neededCols
   * @param {string} [spreadsheetId]
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  private async ensureGridSize(sheet: sheets_v4.Schema$Sheet, neededRows: number, neededCols: number, spreadsheetId?: string): Promise<void> {
    const { rowCount, columnCount } = sheet.properties?.gridProperties || {};
    const rows = rowCount ?? 0;
    const cols = columnCount ?? 0;
    const sheetId = sheet.properties?.sheetId;

    const requests: sheets_v4.Schema$Request[] = [];
    if (neededRows > rows) requests.push({ appendDimension: { sheetId, dimension: 'ROWS', length: neededRows - rows } });
    if (neededCols > cols) requests.push({ appendDimension: { sheetId, dimension: 'COLUMNS', length: neededCols - cols } });
    if (!requests.length) return;

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      requestBody: { requests },
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
  async addWorksheet(title: string, spreadsheetId?: string): Promise<sheets_v4.Schema$Sheet | undefined> {
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
    const sheet = response.data.replies?.[0]?.addSheet;
    this.worksheetTitle = sheet?.properties?.title;
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
              sheetId: sheet.properties?.sheetId || -1,
            },
          },
        ],
      },
    });
    this.worksheetTitle = '';
  }

  /**
   * Rename a worksheet by title
   *
   * @param {string} title
   * @param {string} newTitle
   * @param {string} [spreadsheetId]
   * @returns {Promise<void>}
   * @memberof GoogleSheet
   */
  async renameWorksheet(title: string, newTitle: string, spreadsheetId?: string): Promise<void> {
    const worksheet = await this.getWorksheet(title, spreadsheetId);
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId || this.spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: worksheet.properties?.sheetId || -1,
                title: newTitle,
              },
              fields: 'title',
            },
          },
        ],
      },
    });
    this.worksheetTitle = newTitle;
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
    if (sheet.spreadsheetId) {
      this.spreadsheetId = sheet.spreadsheetId;
    }
    return sheet;
  }
}
