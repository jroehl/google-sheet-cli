import { Args, Command, Flags, ux } from '@oclif/core';
import GoogleSheet, { GoogleSheetCli } from './google-sheet';

export const spreadsheetId = Flags.string({
  char: 's',
  description: 'ID of the spreadsheet to use',
  required: true,
  env: 'SPREADSHEET_ID',
});

export const worksheetTitle = Flags.string({
  char: 't',
  description: 'Title of the worksheet to use',
  required: true,
  env: 'WORKSHEET_TITLE',
});
export const valueInputOption = Flags.string({
  char: 'v',
  description: 'The style of the input ("RAW" or "USER_ENTERED")',
  required: false,
  options: [GoogleSheetCli.ValueInputOption.RAW, GoogleSheetCli.ValueInputOption.USER_ENTERED],
  default: GoogleSheetCli.ValueInputOption.RAW,
  env: 'VALUE_INPUT_OPTION',
});

export const data = Args.string({
  name: 'data',
  type: 'string',
  description: 'The data to be used as a JSON string - nested array [["1", "2", "3"]]',
  required: true,
  env: 'DATA',
});

export default abstract class extends Command {
  private rawLogs: boolean = false;
  public gsheet!: GoogleSheet;

  static flags = {
    help: Flags.help({ char: 'h' }),
    rawOutput: Flags.boolean({
      char: 'r',
      description: 'Get the raw output as a JSON string',
      default: false,
      required: false,
    }),
  };

  async start(message: string) {
    if (!this.rawLogs) {
      ux.action.start(message);
    }
  }

  async stop(message?: string) {
    if (!this.rawLogs) {
      ux.action.stop(message);
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
    const { flags } = await this.parse(<any>this.constructor);
    this.rawLogs = flags && (flags as any).rawOutput;

    const {
      GSHEET_CLIENT_EMAIL = await ux.prompt('What is your client email?', { type: 'hide' }),
      GSHEET_PRIVATE_KEY = await ux.prompt('What is your private key?', { type: 'hide' }),
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
