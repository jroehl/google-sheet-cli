import { generateKeyPairSync } from 'crypto';
import { PassThrough } from 'stream';
import { URL } from 'url';

// The live builtin module objects, not the namespace copies an `import * as` would
// produce, so that swapping `.request` is visible to node-fetch inside gaxios.
const httpsModule = require('https');
const httpModule = require('http');

/**
 * An in-memory fake of the Google Sheets v4 REST API.
 *
 * It is installed over `https.request`, so everything above the socket runs for real:
 * the googleapis client, google-auth-library, gtoken, gaxios and node-fetch all build
 * their requests and parse the responses exactly as they do against Google. That makes
 * these tests a behavioral contract for `GoogleSheet` rather than an assertion about stubs.
 *
 * The A1 handling below is written from scratch instead of reusing `src/lib/utils.ts`,
 * so a bug in the production parser cannot hide itself inside the fake.
 */

const TOKEN_URL = 'https://www.googleapis.com/oauth2/v4/token';
const SHEETS_HOST = 'sheets.googleapis.com';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface FakeWorksheet {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
  /** cell values keyed by `${row}:${col}`, both 1 based */
  cells: Map<string, string>;
}

export interface FakeSpreadsheet {
  spreadsheetId: string;
  title: string;
  sheets: FakeWorksheet[];
}

export interface RecordedRequest {
  method: string;
  url: string;
  body?: any;
}

export interface FakeRange {
  title?: string;
  startRow?: number;
  startCol?: number;
  endRow?: number;
  endCol?: number;
  /** true when the range spelled out an end ("A1:B2"), false for a bare anchor cell ("A1") */
  bounded: boolean;
}

interface FakeResponse {
  status: number;
  body: any;
}

interface ResolvedRange {
  sheet: FakeWorksheet;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  bounded: boolean;
}

/**
 * Convert a column label ("A", "AA") to a 1 based column number
 *
 * @param {string} label
 * @returns {number}
 */
export const letterToCol = (label: string): number =>
  label
    .toUpperCase()
    .split('')
    .reduce((acc, char) => acc * ALPHABET.length + (char.charCodeAt(0) - 64), 0);

/**
 * Convert a 1 based column number to a column label
 *
 * @param {number} col
 * @returns {string}
 */
export const colToLetter = (col: number): string => {
  let div = col;
  let label = '';
  while (div > 0) {
    const mod = (div - 1) % ALPHABET.length;
    label = `${ALPHABET[mod]}${label}`;
    div = Math.floor((div - mod - 1) / ALPHABET.length);
  }
  return label;
};

/**
 * Parse one A1 cell reference into row and column, either of which may be missing
 *
 * @param {string} ref
 * @returns {{ col?: number; row?: number }}
 */
const parseCell = (ref: string): { col?: number; row?: number } => {
  const match = ref.match(/^\$?([A-Za-z]+)?\$?(\d+)?$/);
  if (!match || (!match[1] && !match[2])) throw new Error(`Unable to parse range: ${ref}`);
  return {
    col: match[1] ? letterToCol(match[1]) : undefined,
    row: match[2] ? parseInt(match[2], 10) : undefined,
  };
};

/**
 * Parse an A1 range the way the Sheets API does, independently of the production parser
 *
 * @param {string} range
 * @returns {FakeRange}
 */
export const parseFakeRange = (range: string): FakeRange => {
  let title: string | undefined;
  let rest = range;

  const quote = range[0];
  if (quote === "'" || quote === '"') {
    let i = 1;
    let unquoted = '';
    for (; i < range.length; i++) {
      if (range[i] === quote) {
        if (range[i + 1] === quote) {
          unquoted += quote;
          i++;
          continue;
        }
        break;
      }
      unquoted += range[i];
    }
    if (range[i] !== quote) throw new Error(`Unable to parse range: ${range}`);
    title = unquoted;
    rest = range.slice(i + 1);
    if (rest.startsWith('!')) rest = rest.slice(1);
    else if (rest.length) throw new Error(`Unable to parse range: ${range}`);
  } else {
    const bang = range.lastIndexOf('!');
    if (bang >= 0) {
      title = range.slice(0, bang);
      rest = range.slice(bang + 1);
    } else if (/^[A-Za-z]+\d*(:[A-Za-z]*\d*)?$/.test(range) || /^\d+:\d+$/.test(range)) {
      rest = range;
    } else {
      title = range;
      rest = '';
    }
  }

  if (!rest) return { title, bounded: false };

  const [from, to] = rest.split(':');
  const start = parseCell(from);
  const end = to === undefined ? undefined : parseCell(to);

  return {
    title,
    startRow: start.row,
    startCol: start.col,
    endRow: end ? end.row : start.row,
    endCol: end ? end.col : start.col,
    bounded: end !== undefined,
  };
};

/**
 * Whether A1 notation has to put a worksheet title in quotes to name it.
 *
 * Sheets used to quote the title of every range it echoed. Since September 2026 it quotes only
 * the titles that cannot be written bare, which is what this reproduces: anything outside
 * letters, digits and underscores or not starting with a letter (a space, punctuation, a
 * leading digit), a title that would read as a cell reference instead - a column label is at
 * most three letters, so `A1` and `ZZZ100` need quotes while `Sheet1` does not - and the two
 * boolean literals.
 *
 * Measured against the live API on 2026-09-07: a request for `'worksheet_remove_168...'!A1:Z1000`
 * came back as `worksheet_remove_168...!A1:Z1000`.
 *
 * @param {string} title
 * @returns {boolean}
 */
const needsQuoting = (title: string): boolean =>
  !/^[A-Za-z][A-Za-z0-9_]*$/.test(title) || /^[A-Za-z]{1,3}[0-9]+$/.test(title) || /^(TRUE|FALSE)$/i.test(title);

/**
 * Render a range back to the A1 notation the Sheets API echoes in its responses
 *
 * @param {string} title
 * @param {number} startRow
 * @param {number} startCol
 * @param {number} [endRow]
 * @param {number} [endCol]
 * @returns {string}
 */
const formatRange = (title: string, startRow: number, startCol: number, endRow?: number, endCol?: number): string => {
  const named = needsQuoting(title) ? `'${title.replace(/'/g, "''")}'` : title;
  const start = `${colToLetter(startCol)}${startRow}`;
  if (endRow === undefined && endCol === undefined) return `${named}!${start}`;
  return `${named}!${start}:${colToLetter(endCol as number)}${endRow}`;
};

export class FakeSheets {
  readonly spreadsheets = new Map<string, FakeSpreadsheet>();
  readonly requests: RecordedRequest[] = [];
  readonly credentials: { client_email: string; private_key: string };

  private nextSheetId = 100;
  private nextSpreadsheetId = 1;
  private originalHttpsRequest?: Function;
  private originalHttpRequest?: Function;

  constructor() {
    // gtoken really signs the assertion, so the fake needs a real key
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    this.credentials = { client_email: 'fake@fake-project.iam.gserviceaccount.com', private_key: privateKey as unknown as string };
  }

  /**
   * Route every https request through the fake API
   *
   * @returns {void}
   * @memberof FakeSheets
   */
  install(): void {
    if (this.originalHttpsRequest) return;
    this.originalHttpsRequest = httpsModule.request;
    this.originalHttpRequest = httpModule.request;
    httpsModule.request = this.request.bind(this);
    httpModule.request = this.request.bind(this);
  }

  /**
   * Restore the real https module
   *
   * @returns {void}
   * @memberof FakeSheets
   */
  uninstall(): void {
    if (!this.originalHttpsRequest) return;
    httpsModule.request = this.originalHttpsRequest;
    httpModule.request = this.originalHttpRequest;
    this.originalHttpsRequest = undefined;
    this.originalHttpRequest = undefined;
  }

  /**
   * Drop every spreadsheet and every recorded request
   *
   * @returns {void}
   * @memberof FakeSheets
   */
  reset(): void {
    this.spreadsheets.clear();
    this.requests.length = 0;
  }

  /**
   * Create a spreadsheet with the given worksheets
   *
   * @param {string} spreadsheetId
   * @param {string} title
   * @param {{ title: string; rowCount?: number; columnCount?: number }[]} [sheets=[]]
   * @returns {FakeSpreadsheet}
   * @memberof FakeSheets
   */
  addSpreadsheet(spreadsheetId: string, title: string, sheets: { title: string; rowCount?: number; columnCount?: number }[] = []): FakeSpreadsheet {
    const spreadsheet: FakeSpreadsheet = { spreadsheetId, title, sheets: [] };
    sheets.forEach((sheet) => {
      spreadsheet.sheets.push({
        sheetId: this.nextSheetId++,
        title: sheet.title,
        index: spreadsheet.sheets.length,
        rowCount: sheet.rowCount ?? 1000,
        columnCount: sheet.columnCount ?? 26,
        cells: new Map(),
      });
    });
    this.spreadsheets.set(spreadsheetId, spreadsheet);
    return spreadsheet;
  }

  /**
   * Look up a worksheet by title
   *
   * @param {string} spreadsheetId
   * @param {string} title
   * @returns {FakeWorksheet}
   * @memberof FakeSheets
   */
  worksheet(spreadsheetId: string, title: string): FakeWorksheet {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) throw new Error(`No fake spreadsheet "${spreadsheetId}"`);
    const sheet = spreadsheet.sheets.find((s) => s.title === title);
    if (!sheet) throw new Error(`No fake worksheet "${title}" in "${spreadsheetId}"`);
    return sheet;
  }

  /**
   * Read a single cell straight out of the fake, bypassing the API
   *
   * @param {string} spreadsheetId
   * @param {string} title
   * @param {string} a1
   * @returns {string}
   * @memberof FakeSheets
   */
  cell(spreadsheetId: string, title: string, a1: string): string {
    const { startRow, startCol } = parseFakeRange(a1);
    return this.worksheet(spreadsheetId, title).cells.get(`${startRow}:${startCol}`) ?? '';
  }

  /**
   * Fill a block of cells straight into the fake, bypassing the API
   *
   * @param {string} spreadsheetId
   * @param {string} title
   * @param {string} a1
   * @param {any[][]} values
   * @returns {void}
   * @memberof FakeSheets
   */
  setCells(spreadsheetId: string, title: string, a1: string, values: any[][]): void {
    const { startRow = 1, startCol = 1 } = parseFakeRange(a1);
    const sheet = this.worksheet(spreadsheetId, title);
    values.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value === null || value === undefined) return;
        sheet.cells.set(`${startRow + r}:${startCol + c}`, String(value));
      });
    });
  }

  /**
   * Stand-in for `https.request`, answering out of the in-memory state
   *
   * @param {*} options
   * @param {*} [callback]
   * @returns {*}
   * @memberof FakeSheets
   */
  private request(options: any, callback?: any): any {
    const req: any = new PassThrough();
    const chunks: Buffer[] = [];
    req.abort = () => undefined;
    req.setTimeout = () => req;
    req.setNoDelay = () => req;
    req.setSocketKeepAlive = () => req;
    req.flushHeaders = () => undefined;

    const protocol = options.protocol || 'https:';
    const host = options.hostname || options.host || 'localhost';
    const path = options.path || '/';
    const url = `${protocol}//${host}${path}`;
    const method = (options.method || 'GET').toUpperCase();

    req.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let answer: FakeResponse;
      try {
        answer = this.handle(method, url, raw);
      } catch (error) {
        answer = { status: 500, body: { error: { code: 500, message: (error as Error).message, status: 'INTERNAL' } } };
      }
      const payload = Buffer.from(JSON.stringify(answer.body), 'utf8');
      const res: any = new PassThrough();
      res.statusCode = answer.status;
      res.statusMessage = answer.status === 200 ? 'OK' : 'Bad Request';
      res.headers = { 'content-type': 'application/json; charset=UTF-8', 'content-length': String(payload.length) };
      res.rawHeaders = ['content-type', 'application/json; charset=UTF-8', 'content-length', String(payload.length)];
      if (callback) callback(res);
      req.emit('response', res);
      res.end(payload);
    });

    return req;
  }

  /**
   * Route one request to the matching Sheets API handler
   *
   * @param {string} method
   * @param {string} url
   * @param {string} raw
   * @returns {FakeResponse}
   * @memberof FakeSheets
   */
  private handle(method: string, url: string, raw: string): FakeResponse {
    const parsed = new URL(url);
    let body: any;
    if (raw && raw.trim().startsWith('{')) body = JSON.parse(raw);
    else if (raw) body = raw;
    this.requests.push({ method, url, body });

    if (url.startsWith(TOKEN_URL)) {
      return { status: 200, body: { access_token: 'fake-access-token', expires_in: 3600, token_type: 'Bearer' } };
    }

    if (parsed.hostname !== SHEETS_HOST) {
      return { status: 404, body: { error: { code: 404, message: `Unexpected host ${parsed.hostname}`, status: 'NOT_FOUND' } } };
    }

    const path = decodeURIComponent(parsed.pathname);

    if (method === 'POST' && path === '/v4/spreadsheets') return this.createSpreadsheet(body);

    const batch = path.match(/^\/v4\/spreadsheets\/([^/]+):batchUpdate$/);
    if (method === 'POST' && batch) return this.batchUpdate(batch[1], body);

    const values = path.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+?)(:append)?$/);
    if (values) {
      const [, spreadsheetId, range, append] = values;
      if (method === 'GET') return this.valuesGet(spreadsheetId, range);
      if (method === 'PUT') return this.valuesUpdate(spreadsheetId, range, body);
      if (method === 'POST' && append) return this.valuesAppend(spreadsheetId, range, body, parsed);
    }

    const spreadsheet = path.match(/^\/v4\/spreadsheets\/([^/]+)$/);
    if (method === 'GET' && spreadsheet) return this.spreadsheetGet(spreadsheet[1]);

    return { status: 404, body: { error: { code: 404, message: `Unhandled ${method} ${path}`, status: 'NOT_FOUND' } } };
  }

  /**
   * `spreadsheets.create`
   */
  private createSpreadsheet(body: any): FakeResponse {
    const spreadsheetId = `fake-spreadsheet-${this.nextSpreadsheetId++}`;
    const title = body?.properties?.title ?? 'Untitled spreadsheet';
    const spreadsheet = this.addSpreadsheet(spreadsheetId, title, [{ title: 'Sheet1' }]);
    return { status: 200, body: this.renderSpreadsheet(spreadsheet) };
  }

  /**
   * `spreadsheets.get`
   */
  private spreadsheetGet(spreadsheetId: string): FakeResponse {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) return this.notFound();
    return { status: 200, body: this.renderSpreadsheet(spreadsheet) };
  }

  /**
   * `spreadsheets.batchUpdate` for addSheet, deleteSheet, updateSheetProperties and appendDimension
   */
  private batchUpdate(spreadsheetId: string, body: any): FakeResponse {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) return this.notFound();

    const replies: any[] = [];
    for (const request of body?.requests ?? []) {
      if (request.addSheet) {
        const title = request.addSheet.properties?.title;
        if (spreadsheet.sheets.some((s) => s.title === title)) {
          return this.badRequest(`Invalid requests[0].addSheet: A sheet with the name "${title}" already exists. Please enter another name.`);
        }
        const sheet: FakeWorksheet = {
          sheetId: this.nextSheetId++,
          title,
          index: spreadsheet.sheets.length,
          rowCount: request.addSheet.properties?.gridProperties?.rowCount ?? 1000,
          columnCount: request.addSheet.properties?.gridProperties?.columnCount ?? 26,
          cells: new Map(),
        };
        spreadsheet.sheets.push(sheet);
        replies.push({ addSheet: { properties: this.renderSheetProperties(sheet) } });
        continue;
      }

      if (request.deleteSheet) {
        const index = spreadsheet.sheets.findIndex((s) => s.sheetId === request.deleteSheet.sheetId);
        if (index < 0) return this.badRequest(`Invalid requests[0].deleteSheet: No sheet with id: ${request.deleteSheet.sheetId}`);
        spreadsheet.sheets.splice(index, 1);
        spreadsheet.sheets.forEach((s, i) => (s.index = i));
        replies.push({});
        continue;
      }

      if (request.updateSheetProperties) {
        const properties = request.updateSheetProperties.properties ?? {};
        const sheet = spreadsheet.sheets.find((s) => s.sheetId === properties.sheetId);
        if (!sheet) return this.badRequest(`Invalid requests[0].updateSheetProperties: No sheet with id: ${properties.sheetId}`);
        const fields: string[] = String(request.updateSheetProperties.fields ?? '').split(',');
        if (fields.includes('title') || fields.includes('*')) sheet.title = properties.title;
        if (properties.gridProperties?.rowCount) sheet.rowCount = properties.gridProperties.rowCount;
        if (properties.gridProperties?.columnCount) sheet.columnCount = properties.gridProperties.columnCount;
        replies.push({});
        continue;
      }

      if (request.appendDimension) {
        const { sheetId, dimension, length } = request.appendDimension;
        const sheet = spreadsheet.sheets.find((s) => s.sheetId === sheetId);
        if (!sheet) return this.badRequest(`Invalid requests[0].appendDimension: No sheet with id: ${sheetId}`);
        if (!length || length < 1) return this.badRequest('Invalid requests[0].appendDimension: length must be positive.');
        if (dimension === 'ROWS') sheet.rowCount += length;
        else if (dimension === 'COLUMNS') sheet.columnCount += length;
        else return this.badRequest(`Invalid requests[0].appendDimension: unknown dimension ${dimension}`);
        replies.push({});
        continue;
      }

      return this.badRequest(`Invalid requests[0]: unsupported request ${Object.keys(request).join(',')}`);
    }

    return { status: 200, body: { spreadsheetId, replies } };
  }

  /**
   * `spreadsheets.values.get`. A read whose range reaches past the grid is refused exactly the
   * way a write in the same position is refused. That is the strict reading, and the library
   * agrees with it: getData clamps maxRow and maxCol to gridProperties before every read, which
   * is only worth doing if an unclamped read fails.
   */
  private valuesGet(spreadsheetId: string, range: string): FakeResponse {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) return this.notFound();

    let target: ResolvedRange;
    try {
      target = this.resolve(spreadsheet, range);
    } catch (error) {
      return this.badRequest((error as Error).message);
    }

    const gridError = this.checkGrid(target.sheet, range, target, []);
    if (gridError) return gridError;

    const { sheet } = target;
    const startRow = Math.min(target.startRow, sheet.rowCount);
    const startCol = Math.min(target.startCol, sheet.columnCount);
    const endRow = Math.min(target.endRow, sheet.rowCount);
    const endCol = Math.min(target.endCol, sheet.columnCount);

    const rows: string[][] = [];
    for (let r = startRow; r <= endRow; r++) {
      const row: string[] = [];
      for (let c = startCol; c <= endCol; c++) row.push(sheet.cells.get(`${r}:${c}`) ?? '');
      while (row.length && row[row.length - 1] === '') row.pop();
      rows.push(row);
    }
    while (rows.length && rows[rows.length - 1].length === 0) rows.pop();

    const body: any = { range: formatRange(sheet.title, target.startRow, target.startCol, target.endRow, target.endCol), majorDimension: 'ROWS' };
    if (rows.length) body.values = rows;
    return { status: 200, body };
  }

  /**
   * `spreadsheets.values.update`. Writes are strict: the grid never grows on its own.
   */
  private valuesUpdate(spreadsheetId: string, range: string, body: any): FakeResponse {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) return this.notFound();

    let target: ResolvedRange;
    try {
      target = this.resolve(spreadsheet, range);
    } catch (error) {
      return this.badRequest((error as Error).message);
    }

    const { sheet, startRow, startCol } = target;
    const values: any[][] = body?.values ?? [];

    const gridError = this.checkGrid(sheet, range, target, values);
    if (gridError) return gridError;

    let updatedRows = 0;
    let updatedColumns = 0;
    let updatedCells = 0;
    values.forEach((row, r) => {
      if (row.length) updatedRows++;
      updatedColumns = Math.max(updatedColumns, row.length);
      row.forEach((value, c) => {
        // Google ignores null cells rather than clearing them
        if (value === null || value === undefined) return;
        sheet.cells.set(`${startRow + r}:${startCol + c}`, String(value));
        updatedCells++;
      });
    });

    const endRow = startRow + Math.max(values.length, 1) - 1;
    const endCol = startCol + Math.max(updatedColumns, 1) - 1;
    return {
      status: 200,
      body: {
        spreadsheetId,
        updatedRange: formatRange(sheet.title, startRow, startCol, endRow, endCol),
        updatedRows,
        updatedColumns,
        updatedCells,
      },
    };
  }

  /**
   * `spreadsheets.values.append` with `insertDataOption: OVERWRITE`. The grid grows server side.
   */
  private valuesAppend(spreadsheetId: string, range: string, body: any, parsed: URL): FakeResponse {
    const spreadsheet = this.spreadsheets.get(spreadsheetId);
    if (!spreadsheet) return this.notFound();

    let target: ResolvedRange;
    try {
      target = this.resolve(spreadsheet, range);
    } catch (error) {
      return this.badRequest((error as Error).message);
    }

    const insertDataOption = parsed.searchParams.get('insertDataOption') ?? 'OVERWRITE';
    if (insertDataOption === 'INSERT_ROWS') return this.badRequest('The fake only models insertDataOption=OVERWRITE');

    const { sheet, startCol, endCol } = target;
    // the API looks for the last row of the table inside the searched columns
    let lastRow = target.startRow - 1;
    sheet.cells.forEach((value, key) => {
      if (value === '') return;
      const [r, c] = key.split(':').map(Number);
      if (c < startCol || c > endCol) return;
      if (r < target.startRow || r > target.endRow) return;
      if (r > lastRow) lastRow = r;
    });

    const values: any[][] = body?.values ?? [];
    const writeStart = lastRow + 1;
    let updatedColumns = 0;
    values.forEach((row) => (updatedColumns = Math.max(updatedColumns, row.length)));

    // append grows the grid instead of failing
    const neededRows = writeStart + values.length - 1;
    const neededCols = startCol + updatedColumns - 1;
    if (neededRows > sheet.rowCount) sheet.rowCount = neededRows;
    if (neededCols > sheet.columnCount) sheet.columnCount = neededCols;

    let updatedCells = 0;
    values.forEach((row, r) => {
      row.forEach((value, c) => {
        if (value === null || value === undefined) return;
        sheet.cells.set(`${writeStart + r}:${startCol + c}`, String(value));
        updatedCells++;
      });
    });

    return {
      status: 200,
      body: {
        spreadsheetId,
        tableRange: formatRange(sheet.title, target.startRow, startCol, lastRow, endCol),
        updates: {
          spreadsheetId,
          updatedRange: formatRange(sheet.title, writeStart, startCol, writeStart + values.length - 1, startCol + updatedColumns - 1),
          updatedRows: values.length,
          updatedColumns,
          updatedCells,
        },
      },
    };
  }

  /**
   * Resolve a request range against a spreadsheet, defaulting to the whole grid
   */
  private resolve(spreadsheet: FakeSpreadsheet, range: string): ResolvedRange {
    const parsed = parseFakeRange(range);
    const sheet = parsed.title ? spreadsheet.sheets.find((s) => s.title === parsed.title) : spreadsheet.sheets[0];
    if (!sheet) throw new Error(`Unable to parse range: ${range}`);

    return {
      sheet,
      startRow: parsed.startRow ?? 1,
      startCol: parsed.startCol ?? 1,
      endRow: parsed.endRow ?? sheet.rowCount,
      endCol: parsed.endCol ?? sheet.columnCount,
      bounded: parsed.bounded,
    };
  }

  /**
   * Reproduce the ways the API refuses a write that does not fit the grid
   */
  private checkGrid(sheet: FakeWorksheet, range: string, target: ResolvedRange, values: any[][]): FakeResponse | undefined {
    const parsed = parseFakeRange(range);
    const limits = `Max rows: ${sheet.rowCount}, max columns: ${sheet.columnCount}`;

    if (target.startRow > sheet.rowCount || target.startCol > sheet.columnCount) {
      return this.badRequest(`Range (${sheet.title}!${colToLetter(target.startCol)}${target.startRow}) exceeds grid limits. ${limits}`);
    }
    if (parsed.bounded && parsed.endRow !== undefined && (parsed.endRow > sheet.rowCount || (parsed.endCol ?? 1) > sheet.columnCount)) {
      return this.badRequest(`Range (${sheet.title}!${colToLetter(parsed.endCol ?? 1)}${parsed.endRow}) exceeds grid limits. ${limits}`);
    }

    let longest = 0;
    values.forEach((row) => (longest = Math.max(longest, row.length)));
    const lastRow = target.startRow + values.length - 1;
    const lastCol = target.startCol + longest - 1;

    if (lastRow > sheet.rowCount) return this.badRequest(`Requested writing within range [${range}], but tried writing to row [${lastRow}]`);
    if (lastCol > sheet.columnCount) return this.badRequest(`Requested writing within range [${range}], but tried writing to column [${colToLetter(lastCol)}]`);
    if (target.bounded && lastRow > target.endRow) return this.badRequest(`Requested writing within range [${range}], but tried writing to row [${lastRow}]`);
    if (target.bounded && lastCol > target.endCol) {
      return this.badRequest(`Requested writing within range [${range}], but tried writing to column [${colToLetter(lastCol)}]`);
    }
    return undefined;
  }

  private renderSheetProperties(sheet: FakeWorksheet): any {
    return {
      sheetId: sheet.sheetId,
      title: sheet.title,
      index: sheet.index,
      sheetType: 'GRID',
      gridProperties: { rowCount: sheet.rowCount, columnCount: sheet.columnCount },
    };
  }

  private renderSpreadsheet(spreadsheet: FakeSpreadsheet): any {
    return {
      spreadsheetId: spreadsheet.spreadsheetId,
      properties: { title: spreadsheet.title, locale: 'en_US', timeZone: 'Etc/GMT' },
      sheets: spreadsheet.sheets.map((sheet) => ({ properties: this.renderSheetProperties(sheet) })),
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}/edit`,
    };
  }

  private notFound(): FakeResponse {
    return { status: 404, body: { error: { code: 404, message: 'Requested entity was not found.', status: 'NOT_FOUND' } } };
  }

  private badRequest(message: string): FakeResponse {
    return { status: 400, body: { error: { code: 400, message, status: 'INVALID_ARGUMENT' } } };
  }
}
