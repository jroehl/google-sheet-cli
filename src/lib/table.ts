/**
 * The table renderer and the table flags `data:get` has always exposed.
 *
 * `@oclif/core` 2 shipped these as `ux.table` and `ux.table.flags()`. Core 4 dropped both and
 * core 5 has no replacement that keeps the flags (`@oclif/table` renders a different, boxed
 * table and brings React with it), so the implementation is carried here from
 * `@oclif/core@2.8.11` to keep `data:get` printing what it printed on 2.2.x, flag for flag and
 * column for column. It is not meant to grow: it is the 2.x behaviour frozen in place.
 *
 * Derived from https://github.com/oclif/core/blob/v2.8.11/src/cli-ux/styled/table.ts
 *
 *   Copyright (c) 2018 Salesforce.com
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 *   and associated documentation files (the "Software"), to deal in the Software without
 *   restriction, including without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
 *   Software is furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all copies or
 *   substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 *   BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 *   DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import { Flags, settings } from '@oclif/core';
import chalk from 'chalk';
import { safeDump } from 'js-yaml';
import { orderBy } from 'natural-orderby';
import { inspect } from 'util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sw: (input: string) => number = require('string-width');

export interface TableColumn<T extends Record<string, unknown>> {
  extended?: boolean;
  header?: string;
  minWidth?: number;
  get?(row: T): string;
}

export type TableColumns<T extends Record<string, unknown>> = { [key: string]: TableColumn<T> };

export interface TableOptions {
  columns?: string;
  csv?: boolean;
  extended?: boolean;
  filter?: string;
  'no-header'?: boolean;
  'no-truncate'?: boolean;
  output?: string;
  printLine?(s: string): void;
  rowStart?: string;
  sort?: string;
  title?: string;
}

interface ResolvedColumn {
  extended: boolean;
  get(row: Record<string, unknown>): unknown;
  header: string;
  key: string;
  minWidth: number;
}

/** `capitalize` as `@oclif/core` 2 defined it, which is what turns the key "(A)" into "(a)". */
const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');

const sumBy = <T>(arr: T[], fn: (i: T) => number): number => arr.reduce((sum, i) => sum + fn(i), 0);

/**
 * `@oclif/core`'s `stdtermwidth`, including the `settings.columns` fallback (`global.oclif.columns`)
 * that OCLIF_COLUMNS overrides. Read per call rather than once at module load, so a resized
 * terminal is honoured; that is the one deliberate difference from core 2.
 */
const stdtermwidth = (): number => {
  const columns = Number.parseInt(process.env.OCLIF_COLUMNS!, 10) || settings.columns;
  if (columns) return columns;
  if (!process.stdout.isTTY) return 80;
  const width = process.stdout.getWindowSize()[0];
  if (width < 1) return 80;
  if (width < 40) return 40;
  return width;
};

const getWidestColumnWith = (data: Record<string, string>[], columnKey: string): number =>
  data.reduce((previous, current) => {
    const d = current[columnKey];
    // convert multi-line cell to single longest line for width calculations
    const manyLines = d.split('\n');
    return Math.max(previous, manyLines.length > 1 ? Math.max(...manyLines.map((r) => sw(r))) : sw(d));
  }, 0);

class Table<T extends Record<string, unknown>> {
  private columns: ResolvedColumn[];
  private data: any[];
  private options: Required<Pick<TableOptions, 'no-header' | 'no-truncate' | 'printLine'>> & TableOptions;

  constructor(data: T[], columns: TableColumns<T>, options: TableOptions = {}) {
    this.data = data;

    this.columns = Object.keys(columns).map((key) => {
      const col = columns[key];
      const extended = col.extended ?? false;
      // turn null and undefined into empty strings by default
      const get = col.get ?? ((row: any) => row[key] ?? '');
      const header = typeof col.header === 'string' ? col.header : capitalize(key.replace(/_/g, ' '));
      const minWidth = Math.max(col.minWidth ?? 0, sw(header) + 1);
      return { extended, get, header, key, minWidth };
    });

    const { columns: cols, filter, csv, output, extended, sort, title, printLine } = options;
    this.options = {
      columns: cols,
      output: csv ? 'csv' : output,
      extended,
      filter,
      'no-header': options['no-header'] ?? false,
      'no-truncate': options['no-truncate'] ?? false,
      printLine: printLine ?? ((s: string) => process.stdout.write(s + '\n')),
      rowStart: ' ',
      sort,
      title,
    };
  }

  display(): void {
    // build table rows from input array data
    let rows = this.data.map((d) => {
      const row: Record<string, string> = {};
      for (const col of this.columns) {
        let val = col.get(d);
        if (typeof val !== 'string') val = inspect(val, { breakLength: Number.POSITIVE_INFINITY });
        row[col.key] = val as string;
      }
      return row;
    });

    // filter rows
    if (this.options.filter) {
      // eslint-disable-next-line prefer-const
      let [header, regex] = this.options.filter.split('=');
      const isNot = header[0] === '-';
      if (isNot) header = header.slice(1);
      const col = this.findColumnFromHeader(header);
      if (!col || !regex) throw new Error('Filter flag has an invalid value');
      rows = rows.filter((d) => {
        const re = new RegExp(regex);
        const val = d[col.key];
        const match = val.match(re);
        return isNot ? !match : match;
      });
    }

    // sort rows
    if (this.options.sort) {
      const sorters = this.options.sort.split(',');
      const sortHeaders = sorters.map((k) => (k[0] === '-' ? k.slice(1) : k));
      const sortKeys = this.filterColumnsFromHeaders(sortHeaders).map((c) => (v: Record<string, string>) => v[c.key]);
      const sortKeysOrder = sorters.map((k) => (k[0] === '-' ? 'desc' : 'asc'));
      rows = orderBy(rows, sortKeys, sortKeysOrder as any);
    }

    // and filter columns
    if (this.options.columns) {
      const filters = this.options.columns.split(',');
      this.columns = this.filterColumnsFromHeaders(filters);
    } else if (!this.options.extended) {
      // show extended columns/properties
      this.columns = this.columns.filter((c) => !c.extended);
    }

    this.data = rows;

    switch (this.options.output) {
      case 'csv':
        this.outputCSV();
        break;
      case 'json':
        this.outputJSON();
        break;
      case 'yaml':
        this.outputYAML();
        break;
      default:
        this.outputTable();
    }
  }

  private findColumnFromHeader(header: string): ResolvedColumn | undefined {
    return this.columns.find((c) => c.header.toLowerCase() === header.toLowerCase());
  }

  private filterColumnsFromHeaders(filters: string[]): ResolvedColumn[] {
    // unique
    filters = [...new Set(filters)];
    const cols: ResolvedColumn[] = [];
    for (const f of filters) {
      const c = this.columns.find((c) => c.header.toLowerCase() === f.toLowerCase());
      if (c) cols.push(c);
    }
    return cols;
  }

  private getCSVRow(d: Record<string, string>): string[] {
    const values = this.columns.map((col) => d[col.key] || '');
    const lineToBeEscaped = values.find((e) => e.includes('"') || e.includes('\n') || e.includes('\r\n') || e.includes('\r') || e.includes(','));
    return values.map((e) => (lineToBeEscaped ? `"${e.replace('"', '""')}"` : e));
  }

  private resolveColumnsToObjectArray(): Record<string, string>[] {
    const { data, columns } = this;
    return data.map((d: Record<string, string>) =>
      columns.reduce((obj, col) => ({ ...obj, [col.key]: d[col.key] ?? '' }), {} as Record<string, string>),
    );
  }

  private outputJSON(): void {
    this.options.printLine(JSON.stringify(this.resolveColumnsToObjectArray(), undefined, 2));
  }

  private outputYAML(): void {
    this.options.printLine(safeDump(this.resolveColumnsToObjectArray()));
  }

  private outputCSV(): void {
    const { data, columns, options } = this;
    if (!options['no-header']) {
      options.printLine(columns.map((c) => c.header).join(','));
    }
    for (const d of data) {
      options.printLine(this.getCSVRow(d).join(','));
    }
  }

  private outputTable(): void {
    const { data, options } = this;

    // find max width for each column
    const columns = this.columns.map((c) => {
      const maxWidth = Math.max(sw('.'.padEnd(c.minWidth - 1)), sw(c.header), getWidestColumnWith(data, c.key)) + 1;
      return { ...c, maxWidth, width: maxWidth };
    });

    const maxWidth = stdtermwidth() - 2;

    const shouldShorten = () => {
      // don't shorten if full mode
      if (options['no-truncate'] || (!process.stdout.isTTY && !process.env.CLI_UX_SKIP_TTY_CHECK)) return;

      // don't shorten if there is enough screen width
      const dataMaxWidth = sumBy(columns, (c) => c.width);
      const overWidth = dataMaxWidth - maxWidth;
      if (overWidth <= 0) return;

      // not enough room, short all columns to minWidth
      for (const col of columns) {
        col.width = col.minWidth;
      }

      // if sum(minWidth's) is greater than term width nothing can be done, so display all as minWidth
      const dataMinWidth = sumBy(columns, (c) => c.minWidth);
      if (dataMinWidth >= maxWidth) return;

      // some wiggle room left, add it back to "needy" columns
      let wiggleRoom = maxWidth - dataMinWidth;
      const needyCols = columns.map((c) => ({ key: c.key, needs: c.maxWidth - c.width })).sort((a, b) => a.needs - b.needs);
      for (const { key, needs } of needyCols) {
        if (!needs) continue;
        const col = columns.find((c) => key === c.key);
        if (!col) continue;
        if (wiggleRoom > needs) {
          col.width = col.width + needs;
          wiggleRoom -= needs;
        } else if (wiggleRoom) {
          col.width = col.width + wiggleRoom;
          wiggleRoom = 0;
        }
      }
    };

    shouldShorten();

    // print table title
    if (options.title) {
      options.printLine(options.title);
      // print title divider
      options.printLine(
        ''.padEnd(
          columns.reduce((sum, col) => sum + col.width, 1),
          '=',
        ),
      );
      options.rowStart = '| ';
    }

    // print headers
    if (!options['no-header']) {
      let headers = options.rowStart!;
      for (const col of columns) {
        headers += col.header.padEnd(col.width);
      }
      options.printLine(chalk.bold(headers));

      // print header dividers
      let dividers = options.rowStart!;
      for (const col of columns) {
        const divider = ''.padEnd(col.width - 1, '─') + ' ';
        dividers += divider.padEnd(col.width);
      }
      options.printLine(chalk.bold(dividers));
    }

    // print rows, including multi-line cells
    for (const row of data) {
      let numOfLines = 1;
      for (const col of columns) {
        const lines = (row[col.key] as string).split('\n').length;
        if (lines > numOfLines) numOfLines = lines;
      }

      for (const i of [...new Array(numOfLines).keys()]) {
        let l = options.rowStart!;
        for (const col of columns) {
          const width = col.width;
          let d = (row[col.key] as string).split('\n')[i] || '';
          const visualWidth = sw(d);
          const colorWidth = d.length - visualWidth;
          let cell = d.padEnd(width + colorWidth);
          if (cell.length - colorWidth > width || visualWidth === width) {
            cell = cell.slice(0, width - 2) + '… ';
          }
          l += cell;
        }
        options.printLine(l);
      }
    }
  }
}

/**
 * Print `data` as a table, exactly as `ux.table` did on `@oclif/core` 2.
 */
export const table = <T extends Record<string, unknown>>(data: T[], columns: TableColumns<T>, options: TableOptions = {}): void => {
  new Table(data, columns, options).display();
};

/**
 * The flags `ux.table.flags()` used to contribute, name for name and char for char.
 */
export const tableFlags = () => ({
  columns: Flags.string({ exclusive: ['extended'], description: 'only show provided columns (comma-separated)' }),
  sort: Flags.string({ description: "property to sort by (prepend '-' for descending)" }),
  filter: Flags.string({ description: 'filter property by partial string matching, ex: name=foo' }),
  csv: Flags.boolean({ exclusive: ['no-truncate'], description: 'output is csv format [alias: --output=csv]' }),
  output: Flags.string({
    exclusive: ['no-truncate', 'csv'],
    description: 'output in a more machine friendly format',
    options: ['csv', 'json', 'yaml'],
  }),
  extended: Flags.boolean({ exclusive: ['columns'], char: 'x', description: 'show extra columns' }),
  'no-truncate': Flags.boolean({ exclusive: ['csv'], description: 'do not truncate output to fit screen' }),
  'no-header': Flags.boolean({ exclusive: ['csv'], description: 'hide table header from output' }),
});
