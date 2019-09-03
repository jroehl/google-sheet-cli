import { flags } from '@oclif/command';
import cli from 'cli-ux';
import Command, { worksheetTitle, spreadsheetId } from '../../lib/base-class';

export default class UpdateData extends Command {
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
    ...cli.table.flags(),
    spreadsheetId,
    worksheetTitle,
    hasHeaderRow: flags.boolean({ char: 'w', description: 'If the first row should be treated as header row', default: false, required: false }),
    range: flags.string({ description: 'The range to use to query the cells', required: false }),
    minRow: flags.integer({ description: 'The optional starting row of the operation', default: 1, required: false }),
    minCol: flags.integer({ description: 'The optional starting col of the operation', default: 1, required: false }),
    maxRow: flags.integer({ description: 'The optional ending row of the operation', required: false }),
    maxCol: flags.integer({ description: 'The optional ending col of the operation', required: false }),
  };

  async run() {
    const {
      flags: { spreadsheetId, rawOutput, minRow, maxRow, minCol, maxCol, range, hasHeaderRow, worksheetTitle, ...tableOptions },
    } = this.parse(UpdateData);

    this.start('Fetching data');
    const res = await this.gsheet.getData({ minRow, maxRow, minCol, maxCol, range, hasHeaderRow, worksheetTitle }, spreadsheetId);

    if (rawOutput) {
      this.logRaw('', res);
      return;
    }

    const { header, formatted } = res;
    const columns = header.reduce((red, col) => {
      return { ...red, [col]: {} };
    }, {});
    this.stop();
    cli.table(formatted, columns, tableOptions);
  }
}
