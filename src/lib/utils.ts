import { GoogleSheetCli } from './google-sheet';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Get the longest array of array of arrays
 *
 * @param {any[][]} array
 * @returns {{ index: number; array: any[]; length: number }}
 */
export const getLongestArray = (array: any[][]): { index: number; array: any[]; length: number } => {
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
 * Parse a1Notation to col and row
 *
 * @param {string} [a1Notation='']
 * @returns {{ col: number; row: number }}
 */
const parseA1Notation = (a1Notation: string = ''): { col: number; row: number } => {
  const res = { col: 0, row: 0 };
  if (!a1Notation) return res;
  const rowChar = a1Notation.match(/\d+/g)?.[0] ?? '0';

  const colChar = a1Notation.match(/[a-zA-Z]+/g)?.[0];
  return {
    col: colChar === undefined ? 0 : aToCol(colChar),
    row: parseInt(rowChar),
  };
};

/**
 * Parse a range from a1Notation to options
 *
 * @param {GoogleSheetCli.QueryOptions} [options={}]
 * @returns {GoogleSheetCli.QueryOptions[]}
 */
export const parseRange = (range: string): Pick<GoogleSheetCli.QueryOptions, 'maxCol' | 'minCol' | 'maxRow' | 'minRow' | 'worksheetTitle'> => {
  let worksheetTitle: string | undefined | null;
  let a1Notation: string;

  const split = range.match(/(["']?.*["']?)\!(.*)/);
  if (split) {
    [, worksheetTitle, a1Notation] = split;
  } else {
    a1Notation = range;
  }

  worksheetTitle = worksheetTitle?.match(/^['"](.*)['"]$/)?.[1];

  const [from, to] = a1Notation.split(':');

  try {
    const { col: minCol, row: minRow } = parseA1Notation(from);
    const { col: maxCol, row: maxRow } = parseA1Notation(to);

    if (!minCol && !minRow && !maxCol && !maxRow) {
      return { worksheetTitle };
    }
    return {
      maxCol: maxCol || minCol,
      minCol,
      maxRow: maxRow || minRow,
      minRow,
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
