import Command, { flags } from '@oclif/command';
import cli from 'cli-ux';
import GoogleSheet, { GoogleSheetCli } from './google-sheet';

export const spreadsheetId = flags.string({
  char: 's',
  description: 'ID of the spreadsheet to use',
  required: true,
  env: 'SPREADSHEET_ID',
});

export const worksheetTitle = flags.string({
  char: 't',
  description: 'Title of the worksheet to use',
  required: true,
  env: 'WORKSHEET_TITLE',
});
export const valueInputOption = flags.string({
  char: 'v',
  description: 'The style of the input ("RAW" or "USER_ENTERED")',
  required: false,
  options: [GoogleSheetCli.ValueInputOption.RAW, GoogleSheetCli.ValueInputOption.USER_ENTERED],
  default: GoogleSheetCli.ValueInputOption.RAW,
  env: 'VALUE_INPUT_OPTION',
});

export const data = {
  name: 'data',
  type: 'string',
  description: 'The data to be used as a JSON string - nested array [["1", "2", "3"]]',
  required: true,
  env: 'DATA',
};

export default abstract class extends Command {
  private rawLogs: boolean = false;
  public gsheet!: GoogleSheet;

  static flags = {
    help: flags.help({ char: 'h' }),
    rawOutput: flags.boolean({
      char: 'r',
      description: 'Get the raw output as a JSON string',
      default: false,
      required: false,
    }),
  };

  async start(message: string) {
    if (!this.rawLogs) {
      cli.action.start(message);
    }
  }

  async stop(message?: string) {
    if (!this.rawLogs) {
      cli.action.stop(message);
    }
  }

  async logRaw(message: string, raw?: any) {
    if (this.rawLogs) {
      this.log(JSON.stringify(raw, null, 2));
    } else {
      this.log(message);
    }
  }

  async init() {
    // do some initialization
    const { flags } = this.parse(<any>this.constructor);
    this.rawLogs = flags && (flags as any).rawOutput;

    const {
      GSHEET_CLIENT_EMAIL = await cli.prompt('What is your client email?', { type: 'hide' }),
      GSHEET_PRIVATE_KEY = await cli.prompt('What is your private key?', { type: 'hide' }),
    } = process.env;

    const gsheet = new GoogleSheet();
    await gsheet.authorize({
      client_email: GSHEET_CLIENT_EMAIL,
      private_key: GSHEET_PRIVATE_KEY,
    });

    this.gsheet = gsheet;
  }

  async catch(err: Error) {
    this.error(err, { exit: 1 });
    // handle any error from the command
  }
}
