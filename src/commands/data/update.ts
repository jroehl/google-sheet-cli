import { Flags } from '@oclif/core';
import Command, { data, spreadsheetId, valueInputOption, worksheetTitle } from '../../lib/base-class';

export default class UpdateData extends Command {
  static description = 'Updates cells with the specified data';

  static examples = [
    `$ gsheet data:update --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> '[["1", "2", "3"]]'

Data successfully updated in "<worksheetTitle>"
`,
  ];

  static flags = {
    ...Command.flags,
    worksheetTitle,
    spreadsheetId,
    valueInputOption,
    minRow: Flags.integer({ description: 'The optional starting row of the operation', default: 1, required: false }),
    minCol: Flags.integer({ description: 'The optional starting col of the operation', default: 1, required: false }),
  };

  static args = { data };

  async run() {
    const {
      args: { data },
      flags: { minRow, minCol, worksheetTitle = '', spreadsheetId, valueInputOption },
    } = await this.parse(UpdateData);

    try {
      this.start('Updating data');

      console.log();

      let parsed = data;
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }

      const options: any = { worksheetTitle, minCol, minRow, valueInputOption };

      await this.gsheet.updateData(parsed, options, spreadsheetId);
      this.stop();
      const result = { operation: this.id, worksheetTitle, data: parsed };
      this.logRaw(`Data successfully updated in "${worksheetTitle}"`, result);
      return result;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`"data" input has to be valid JSON (${error.message || error})`);
      }
      throw error;
    }
  }
}
