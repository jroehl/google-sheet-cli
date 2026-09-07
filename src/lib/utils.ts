import { GoogleSheetCli } from './google-sheet';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** one A1 cell reference, with an optional column part and an optional row part */
const A1_CELL = /^\$?([A-Z]+)?\$?(\d+)?$/;

/**
 * Get the longest array of array of arrays
 *
 * @param {any[][]} array
 * @returns {{ index: number; array: any[]; length: number }}
 */
export const getLongestArray = (array: any[][]): { index: number; array: any[]; length: number } => {
  if (!Array.isArray(array) || !array.length) return { index: -1, array: [], length: 0 };
  const index = array.reduce((p: number, c: any[], i: number, a: any[][]) => (a[p].length > c.length ? p : i), 0);
  const longest = array[index];
  return { index, array: longest, length: longest.length };
};

/**
 * Convert number to A1 notation
 *
 * @param {number} col
 * @returns {string}
 */
export const colToA = (col: number): string => {
  if (col < 1) throw 'col has to be greater than 1';

  const { length } = ALPHABET;

  let div = col;
  let columnLabel = '';
  while (div) {
    let mod = div % length;
    div = Math.floor(div / length);
    if (mod == 0) {
      mod = ALPHABET.length;
      div -= 1;
    }
    columnLabel = `${ALPHABET[mod - 1]}${columnLabel}`;
  }
  return columnLabel;
};

/**
 * Convert A1 notation to number
 *
 * @param {string} label
 * @returns {number}
 */
export const aToCol = (label: string): number => {
  const match = label.match(/[A-Z0-9]+/);
  if (!match || match[0].length !== label.length) throw `Label has to be uppercase alphabet letter but is "${label}"`;

  const col = label
    .split('')
    .reverse()
    .reduce((col, char, i) => {
      return col + (char.charCodeAt(0) - 64) * ALPHABET.length ** i;
    }, 0);

  return col;
};

/**
 * Parse a single a1Notation cell reference. Either half may be missing ("B", "5", "B5").
 *
 * @param {string} a1Notation
 * @returns {{ col?: number; row?: number }}
 */
const parseA1Notation = (a1Notation: string): { col?: number; row?: number } => {
  const match = a1Notation.match(A1_CELL);
  if (!match || (!match[1] && !match[2])) throw new Error(`Unparseable cell reference "${a1Notation}"`);
  return {
    col: match[1] ? aToCol(match[1]) : undefined,
    row: match[2] ? parseInt(match[2], 10) : undefined,
  };
};

/**
 * Split a range into its worksheet title and its a1Notation. A quoted title may contain
 * spaces, exclamation marks and apostrophes escaped by doubling them ('O''Brien').
 *
 * @param {string} range
 * @returns {{ worksheetTitle?: string; a1Notation: string }}
 */
const splitRange = (range: string): { worksheetTitle?: string; a1Notation: string } => {
  const quote = range[0];
  if (quote === "'" || quote === '"') {
    let index = 1;
    let worksheetTitle = '';
    for (; index < range.length; index++) {
      if (range[index] === quote) {
        if (range[index + 1] === quote) {
          worksheetTitle += quote;
          index++;
          continue;
        }
        break;
      }
      worksheetTitle += range[index];
    }
    // an unterminated quote, or a quoted title that is not followed by "!", is not a range
    if (range[index] !== quote) throw new Error(`Invalid range "${range}"`);
    const rest = range.slice(index + 1);
    if (rest[0] !== '!') throw new Error(`Invalid range "${range}"`);
    return { worksheetTitle, a1Notation: rest.slice(1) };
  }

  const separator = range.lastIndexOf('!');
  if (separator < 0) return { a1Notation: range };
  return { worksheetTitle: range.slice(0, separator), a1Notation: range.slice(separator + 1) };
};

/**
 * Parse a range from a1Notation to options
 *
 * @param {string} range
 * @returns {Pick<GoogleSheetCli.QueryOptions, 'maxCol' | 'minCol' | 'maxRow' | 'minRow' | 'worksheetTitle'>}
 */
export const parseRange = (range: string): Pick<GoogleSheetCli.QueryOptions, 'maxCol' | 'minCol' | 'maxRow' | 'minRow' | 'worksheetTitle'> => {
  const { worksheetTitle, a1Notation } = splitRange(range);

  // "'title'!" addresses the whole worksheet. A range with neither half names nothing, which
  // is what the old parser returned for it, so it keeps returning that rather than throwing.
  if (!a1Notation) return { worksheetTitle: worksheetTitle || undefined };

  try {
    const [from, to] = a1Notation.split(':');
    const start = parseA1Notation(from);
    const end = a1Notation.includes(':') ? parseA1Notation(to) : undefined;

    return {
      maxCol: end ? end.col : start.col,
      minCol: start.col,
      maxRow: end ? end.row : start.row,
      minRow: start.row,
      worksheetTitle,
    };
  } catch (error) {
    throw new Error(`Invalid range "${range}"`);
  }
};

/**
 * Convert query options to range notation
 *
 * @param {GoogleSheetCli.QueryOptions} [options={}]
 * @returns {string}
 */
export const getRange = (options: GoogleSheetCli.QueryOptions = {}): string => {
  const { minCol, minRow, maxCol, maxRow, worksheetTitle, range } = options;
  if (range) return range;
  const title = `'${worksheetTitle}'`;
  if (!minCol && !minRow && !maxCol && !maxRow) return title;
  if (!maxCol && !maxRow) return `${title}!${colToA(minCol || 1)}${minRow || 1}`;
  return `${title}!${colToA(minCol || 1)}${minRow || 1}:${maxCol ? colToA(maxCol) : ''}${maxRow || ''}`;
};

/**
 * Work out how big the grid has to be for `data` to fit the range the options describe.
 *
 * The write lands wherever `getRange` points, so an explicit range wins over minRow and
 * minCol exactly as it does there. A range with a bounded end has to hold the data, and
 * the grid has to hold the whole range, because the API rejects a range that reaches
 * past the grid.
 *
 * @param {GoogleSheetCli.RawData} data
 * @param {GoogleSheetCli.QueryOptions} [options={}]
 * @returns {{ rows: number; cols: number }}
 */
export const requiredGrid = (data: GoogleSheetCli.RawData, options: GoogleSheetCli.QueryOptions = {}): { rows: number; cols: number } => {
  if (!Array.isArray(data) || !data.length || !data.every(Array.isArray)) {
    throw new Error('data has to be a non-empty array of rows');
  }

  const parsed = options.range ? parseRange(options.range) : {};
  const startRow = parsed.minRow || options.minRow || 1;
  const startCol = parsed.minCol || options.minCol || 1;
  const { length: longest } = getLongestArray(data);

  const rows = startRow + data.length - 1;
  const cols = startCol + longest - 1;

  // a range without a ":" is an anchor cell, not a bound; maxRow and maxCol only
  // reach the API when there is no explicit range for getRange to prefer
  let endRow = options.range ? undefined : options.maxRow;
  let endCol = options.range ? undefined : options.maxCol;
  if (options.range && splitRange(options.range).a1Notation.includes(':')) {
    endRow = parsed.maxRow;
    endCol = parsed.maxCol;
  }

  if (options.range && ((endRow && rows > endRow) || (endCol && cols > endCol))) {
    throw new Error(`data (${data.length}x${longest}) does not fit range ${options.range}`);
  }

  return { rows: Math.max(rows, endRow || 0), cols: Math.max(cols, endCol || 0) };
};
