import Command, { spreadsheetId, worksheetTitle } from '../../lib/base-class';

export default class Remove extends Command {
  static description = 'Remove a worksheet with the specified title from the spreadsheet';

  static examples = [
    `$ gsheet worksheet:remove --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

Worksheet "<worksheetTitle>" successfully removed
`,
  ];

  static flags = {
    ...Command.flags,
    worksheetTitle,
    spreadsheetId,
  };

  async run() {
    const {
      flags: { worksheetTitle = '', spreadsheetId },
    } = await this.parse(Remove);

    this.start('Removing worksheet');
    await this.gsheet.removeWorksheet(worksheetTitle, spreadsheetId);
    this.stop();
    this.logRaw(`Worksheet "${worksheetTitle}" successfully removed`, { operation: this.id, worksheetTitle });
  }
}
