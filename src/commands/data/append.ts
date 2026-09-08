import { Flags } from '@oclif/core';
import Command, { data, spreadsheetId, valueInputOption, worksheetTitle } from '../../lib/base-class';

export default class AppendData extends Command {
  static description = 'Append cells with the specified data after the last row in starting col';

  static examples = [
    `$ gsheet data:append --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> '[["1", "2", "3"]]'

Data successfully appended to "<worksheetTitle>"
`,
  ];

  static flags = {
    ...Command.flags,
    worksheetTitle,
    spreadsheetId,
    valueInputOption,
    minCol: Flags.integer({ description: 'The optional starting col of the operation', default: 1, required: false }),
  };

  static args = { data };

  async run() {
    const {
      args: { data },
      flags: { minCol, worksheetTitle = '', spreadsheetId, valueInputOption },
    } = await this.parse(AppendData);

    try {
      this.start('Appending data');

      let parsed = data;
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }

      const options: any = { worksheetTitle, minCol, valueInputOption };

      await this.gsheet.appendData(parsed, options, spreadsheetId);
      this.stop();
      const result = { operation: this.id, worksheetTitle, data: parsed };
      this.logRaw(`Data successfully appended to "${worksheetTitle}"`, result);
      return result;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`"data" input has to be valid JSON (${error.message || error})`);
      }
      throw error;
    }
  }
}
