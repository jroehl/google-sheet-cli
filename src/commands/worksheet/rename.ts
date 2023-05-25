import { Flags } from '@oclif/core';
import Command, { spreadsheetId, worksheetTitle } from '../../lib/base-class';

export default class Add extends Command {
  static description = 'Add a worksheet with the specified title to the spreadsheet';

  static examples = [
    `$ gsheet worksheet:rename --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle> --newWorksheetTitle=<newWorksheetTitle>

Worksheet "<worksheetTitle>" successfully renamed to "<newWorksheetTitle>" 
`,
  ];

  static flags = {
    ...Command.flags,
    worksheetTitle,
    newWorksheetTitle: Flags.string({
      description: 'New title of the worksheet to use',
      required: true,
    }),
    spreadsheetId,
  };

  async run() {
    const {
      flags: { worksheetTitle = '', spreadsheetId, newWorksheetTitle },
    } = await this.parse(Add);

    this.start('Renaming worksheet');
    await this.gsheet.renameWorksheet(worksheetTitle, newWorksheetTitle, spreadsheetId);
    this.stop();
    this.logRaw(`Worksheet "${worksheetTitle}" successfully renamed to "${newWorksheetTitle}"`, { operation: this.id });
  }
}
