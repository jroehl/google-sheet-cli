import Command, { spreadsheetId } from '../../lib/base-class';

export default class Get extends Command {
  static description = 'Get info for a specific spreadsheet';

  static examples = [
    `$ gsheet spreadsheet:get --spreadsheetId=<spreadsheetId>

Fetched "<spreadsheetTitle>" (<id>) > https://docs.google.com/spreadsheets/d/<id>/edit
`,
  ];

  static flags = {
    ...Command.flags,
    spreadsheetId,
  };

  async run() {
    const {
      flags: { spreadsheetId },
    } = await this.parse(Get);

    this.start('Fetching spreadsheet');
    const spreadsheet = await this.gsheet.getSpreadsheet(spreadsheetId);
    const { spreadsheetId: id = '', properties: { title = '' } = {}, spreadsheetUrl } = spreadsheet;
    this.stop();
    this.logRaw(`Fetched spreadsheet "${title}" (${id}) > ${spreadsheetUrl}`, { operation: this.id, ...spreadsheet });
  }
}
