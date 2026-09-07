import { Args, Command, Flags } from '@oclif/core';
import { FlagInput } from '@oclif/core/interfaces';
import { ux } from '@oclif/core/ux';
import { createInterface } from 'readline';
import { normalizeCredentials } from './credentials';
import * as factory from './factory';
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
  description: 'The data to be used as a JSON string - nested array [["1", "2", "3"]]',
  required: true,
});

interface CommonFlags {
  rawOutput: boolean | undefined;
  clientEmail: string | undefined;
  privateKey: string | undefined;
  credentialsFile: string | undefined;
  help: void;
}

// `@oclif/core/interfaces` re-exports `FlagInput` but not these two, and node16 resolution
// refuses the deep path they live behind. Both are index signatures in core itself.
type FlagOutput = { [name: string]: any };
type ArgOutput = { [name: string]: any };

/**
 * Ask for one secret on the terminal without echoing it back.
 *
 * `@oclif/core` 2 had `ux.prompt(message, { type: 'hide' })` for this; core 5 dropped the whole
 * prompt module along with its `password-prompt` dependency, so the same "print the label, read a
 * line, echo nothing" contract is kept here rather than taking a new runtime dependency for it.
 *
 * @param {string} message
 * @returns {Promise<string>}
 */
const hiddenPrompt = (message: string): Promise<string> =>
  new Promise((resolve) => {
    const output = process.stdout;
    const write = output.write.bind(output);
    let muted = false;
    // readline echoes what is typed; swallow those writes until the answer is in
    (output as any).write = (chunk: any, ...rest: any[]) => (muted ? true : write(chunk, ...rest));

    const rl = createInterface({ input: process.stdin, output, terminal: true });
    rl.question(`${message}: `, (answer) => {
      muted = false;
      (output as any).write = write;
      write('\n');
      rl.close();
      resolve(answer.trim());
    });
    muted = true;
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
    clientEmail: Flags.string({
      helpGroup: 'Authentication',
      char: 'c',
      env: 'GSHEET_CLIENT_EMAIL',
      description: 'The client email to use for authentication. Uses the GSHEET_CLIENT_EMAIL env variable if not provided.',
      required: false,
    }),
    privateKey: Flags.string({
      helpGroup: 'Authentication',
      char: 'p',
      env: 'GSHEET_PRIVATE_KEY',
      description: 'The private key to use for authentication. Uses the GSHEET_PRIVATE_KEY env variable if not provided.',
      required: false,
    }),
    credentialsFile: Flags.string({
      helpGroup: 'Authentication',
      char: 'f',
      env: 'GSHEET_CREDENTIALS_FILE',
      description:
        'Path to the service account JSON file to read the credentials from. Uses the GSHEET_CREDENTIALS_FILE env variable if not provided. The clientEmail and privateKey flags take precedence.',
      required: false,
    }),
  } as FlagInput<CommonFlags>;

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
    const { flags } = await this.parse<CommonFlags, FlagOutput, ArgOutput>(<any>this.constructor);
    this.rawLogs = !!flags?.rawOutput;

    // Only prompt for what the flags, the env and the credentials file left missing.
    const credentials = normalizeCredentials({
      client_email: flags?.clientEmail,
      private_key: flags?.privateKey,
      credentialsFile: flags?.credentialsFile,
    });

    const gsheet = factory.createGoogleSheet();
    await gsheet.authorize({
      client_email: credentials.client_email ?? (await hiddenPrompt('What is your client email?')),
      private_key: credentials.private_key ?? (await hiddenPrompt('What is your private key?')),
    });

    this.gsheet = gsheet;
  }

  async catch(err: Error) {
    this.error(err, { exit: 1 });
    // handle any error from the command
  }
}
