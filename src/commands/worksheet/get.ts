import Command, { spreadsheetId, worksheetTitle } from '../../lib/base-class';

export default class Get extends Command {
  static description = 'Get info for a specific worksheet';

  static examples = [
    `$ gsheet worksheet:get --spreadsheetId=<spreadsheetId> --worksheetTitle=<worksheetTitle>

Fetched "<worksheetTitle>" (<id>)
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
    } = await this.parse(Get);

    this.start('Fetching worksheet');
    const worksheet = await this.gsheet.getWorksheet(worksheetTitle, spreadsheetId);
    const { properties: { title = '', sheetId = '' } = {} } = worksheet;
    this.stop();
    this.logRaw(`Fetched "${title}" (${sheetId})`, { operation: this.id, ...worksheet });
  }
}
