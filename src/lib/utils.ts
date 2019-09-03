import { QueryOptions } from './google-sheet';
import { worksheetTitle } from './base-class';

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
  const match = label.match(/[A-Z]+/);
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
  return a1Notation.split('').reduce(
    (red, part: string) => {
      if (part && !parseInt(part)) {
        return { ...red, col: aToCol(part) };
      }
      return { ...red, row: parseInt(part) };
    },
    { col: 0, row: 0 }
  );
};

/**
 * Parse a range from a1Notation to options
 *
 * @param {QueryOptions} [options={}]
 * @returns {QueryOptions[]}
 */
export const parseRanges = (options: QueryOptions = {}): QueryOptions[] => {
  if (!options.range) return [options];
  const [title, a1Notations = ''] = options.range.split('!');

  let worksheetTitle = title;
  const sanitized = title.match(/^['"](.*)['"]$/);
  if (sanitized) {
    worksheetTitle = sanitized[1];
  }

  return a1Notations
    .replace(/[,;]/g, ',')
    .split(',')
    .map(a1Notation => {
      const [from, to] = a1Notation.split(':');
      const { col: minCol, row: minRow } = parseA1Notation(from);
      const { col: maxCol, row: maxRow } = parseA1Notation(to);
      if (!minCol && !minRow && !maxCol && !maxRow) {
        return { ...options, worksheetTitle };
      }
      return {
        ...options,
        maxCol: maxCol || minCol,
        minCol,
        maxRow: maxRow || minRow,
        minRow,
        worksheetTitle,
      };
    });
};

/**
 * Convert query options to range notation
 *
 * @param {QueryOptions} [options={}]
 * @returns {string}
 */
export const getRange = (options: QueryOptions = {}): string => {
  const { minCol, minRow, maxCol, maxRow, worksheetTitle, range } = options;
  if (range) return range;
  const title = `'${worksheetTitle}'`;
  if (!minCol && !minRow && !maxCol && !maxRow) return title;
  if (!maxCol && !maxRow) return `${title}!${colToA(minCol || 1)}${minRow || 1}`;
  return `${title}!${colToA(minCol || 1)}${minRow || 1}:${maxCol ? colToA(maxCol) : ''}${maxRow || ''}`;
};
