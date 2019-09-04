import { flags } from '@oclif/command';
import Command, { worksheetTitle, spreadsheetId, data } from '../../lib/base-class';

export default class UpdateData extends Command {
  static description = 'Append cells with the specified data after the last row in starting col';

  static examples = [
    `$ gsheet data:append --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --data='[["1", "2", "3"]]'

Data successfully appended to "<worksheetTitle>"
`,
  ];

  static flags = {
    ...Command.flags,
    worksheetTitle,
    spreadsheetId,
    minCol: flags.integer({ description: 'The optional starting col of the operation', default: 1, required: false }),
  };

  static args = [data];

  async run() {
    const {
      args: { data },
      flags: { minCol, worksheetTitle = '', spreadsheetId },
    } = this.parse(UpdateData);

    try {
      this.start('Appending data');

      let parsed = data;
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }

      await this.gsheet.appendData(parsed, { minCol, worksheetTitle }, spreadsheetId);
      this.stop();
      this.logRaw(`Data successfully appended to "${worksheetTitle}"`, { operation: this.id, worksheetTitle, data: parsed });
    } catch (error) {
      throw `"data" input has to be valid JSON (${error.message || error})`;
    }
  }
}
