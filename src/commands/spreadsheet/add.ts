import { flags } from '@oclif/command';
import Command from '../../lib/base-class';

export default class Add extends Command {
  static description = 'Add a worksheet with the specified title to the spreadsheet';

  static examples = [
    `$ gsheet worksheet:add --spreadsheetTitle=<spreadsheetTitle>

Spreadsheet "<spreadsheetTitle>" (<id>) successfully created > https://docs.google.com/spreadsheets/d/<id>/edit
`,
  ];

  static flags = {
    ...Command.flags,
    spreadsheetTitle: flags.string({
      description: 'Title of the spreadsheet',
      required: true,
    }),
  };

  async run() {
    const {
      flags: { spreadsheetTitle = '' },
    } = this.parse(Add);

    this.start('Adding spreadsheet');
    const spreadsheet = await this.gsheet.addSpreadsheet(spreadsheetTitle);
    const { spreadsheetId, properties: { title = '' } = {}, spreadsheetUrl } = spreadsheet;
    this.stop();
    this.logRaw(`Spreadsheet "${title}" (${spreadsheetId}) successfully created > ${spreadsheetUrl}`, spreadsheet);
  }
}
