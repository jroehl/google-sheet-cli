import { flags } from '@oclif/command';
import Command, { worksheetTitle, spreadsheetId } from '../../lib/base-class';

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
    minRow: flags.integer({ description: 'the optional starting row of the operation', default: 1, required: false }),
    minCol: flags.integer({ description: 'the optional starting col of the operation', default: 1, required: false }),
  };

  static args = [
    {
      name: 'data',
      description: 'specifies the data as nested array [["1", "2", "3"]]',
      required: true,
    },
  ];

  async run() {
    const {
      args: { data },
      flags: { minRow, minCol, worksheetTitle = '', spreadsheetId },
    } = this.parse(UpdateData);

    try {
      this.start('Updating data');
      const parsed = JSON.parse(data);
      await this.gsheet.updateData(parsed, { worksheetTitle, minCol, minRow }, spreadsheetId);
      this.stop();
      this.logRaw(`Data successfully updated in "${worksheetTitle}"`, { worksheetTitle, data: parsed });
    } catch (error) {
      throw `"data" input has to be valid JSON (${error.message || error})`;
    }
  }
}
