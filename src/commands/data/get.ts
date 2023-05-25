import { Flags, ux } from '@oclif/core';
import Command, { spreadsheetId, worksheetTitle } from '../../lib/base-class';

export default class GetData extends Command {
  static description = 'Returns cell data';

  static examples = [
    `$ gsheet data:get --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

(a)  (b)  (c)
A1   B1   C1
A2   B2   C2
A3   B3   C3
`,
  ];

  static flags = {
    ...Command.flags,
    ...ux.table.flags(),
    spreadsheetId,
    worksheetTitle,
    hasHeaderRow: Flags.boolean({ char: 'w', description: 'If the first row should be treated as header row', default: false, required: false }),
    range: Flags.string({ description: 'The range to use to query the cells', required: false }),
    minRow: Flags.integer({ description: 'The optional starting row of the operation', default: 1, required: false }),
    minCol: Flags.integer({ description: 'The optional starting col of the operation', default: 1, required: false }),
    maxRow: Flags.integer({ description: 'The optional ending row of the operation', required: false }),
    maxCol: Flags.integer({ description: 'The optional ending col of the operation', required: false }),
  };

  async run() {
    const {
      flags: { spreadsheetId, rawOutput, minRow, maxRow, minCol, maxCol, range, hasHeaderRow, worksheetTitle, ...tableOptions },
    } = await this.parse(GetData);

    this.start('Fetching data');
    const res = await this.gsheet.getData({ minRow, maxRow, minCol, maxCol, range, hasHeaderRow, worksheetTitle }, spreadsheetId);

    if (rawOutput) {
      this.logRaw('', { operation: this.id, ...res });
      return;
    }

    const { header, formatted } = res;
    const columns = header.reduce((red, col) => {
      return { ...red, [col]: {} };
    }, {});
    this.stop();
    ux.table(formatted, columns, tableOptions);
  }
}
