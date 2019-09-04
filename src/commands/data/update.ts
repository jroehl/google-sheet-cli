import { flags } from '@oclif/command';
import Command, { worksheetTitle, spreadsheetId, data, valueInputOption } from '../../lib/base-class';

export default class UpdateData extends Command {
  static description = 'Updates cells with the specified data';

  static examples = [
    `$ gsheet data:update --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --data='[["1", "2", "3"]]'

Data successfully updated in "<worksheetTitle>"
`,
  ];

  static flags = {
    ...Command.flags,
    worksheetTitle,
    spreadsheetId,
    valueInputOption,
    minRow: flags.integer({ description: 'The optional starting row of the operation', default: 1, required: false }),
    minCol: flags.integer({ description: 'The optional starting col of the operation', default: 1, required: false }),
  };

  static args = [data];

  async run() {
    const {
      args: { data },
      flags: { minRow, minCol, worksheetTitle = '', spreadsheetId, valueInputOption },
    } = this.parse(UpdateData);

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
      this.logRaw(`Data successfully updated in "${worksheetTitle}"`, { operation: this.id, worksheetTitle, data: parsed });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw `"data" input has to be valid JSON (${error.message || error})`;
      }
      throw error.message || error;
    }
  }
}
