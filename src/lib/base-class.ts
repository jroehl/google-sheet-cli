import { Args, Command, Flags } from '@oclif/core';
import { FlagInput, OutputArgs, OutputFlags } from '@oclif/core/interfaces';
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

/**
 * Ask for one secret on the terminal without echoing it back.
 *
 * `@oclif/core` 2 had `ux.prompt(message, { type: 'hide' })` for this; core 5 dropped the whole
 * prompt module along with its `password-prompt` dependency, so the contract that dependency
 * provided is kept here rather than taking a new one for it. Three parts of that contract are
 * load-bearing and easy to lose:
 *
 * - everything goes to **stderr**. stdout is the command's output, and `--rawOutput` promises it
 *   is JSON; a prompt written there lands in the middle of a `| jq` pipeline.
 * - an empty answer is refused and the question asked again, rather than being handed on as an
 *   empty credential that fails later as an opaque authentication error.
 * - the muted `write` is put back whatever happens, including on an aborted prompt (EOF, Ctrl-D),
 *   which closes the interface without ever calling back. Leaving it swallowed would silence the
 *   process for good.
 *
 * @param {string} message
 * @returns {Promise<string>}
 */
export const hiddenPrompt = (message: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const stderr = process.stderr;
    // the function itself, not a bound copy: restoring a copy would leave a different `write` on
    // the stream every time, which stacks up and defeats anyone else swapping it
    const write = stderr.write;
    let muted = false;
    let answered = false;

    const restore = () => {
      muted = false;
      (stderr as any).write = write;
    };

    // readline echoes what is typed; swallow those writes while an answer is being entered
    (stderr as any).write = (...args: any[]) => (muted ? true : (write as any).apply(stderr, args));

    const rl = createInterface({ input: process.stdin, output: stderr, terminal: true });

    rl.on('close', () => {
      restore();
      process.stdin.pause();
      if (!answered) reject(new Error('No input'));
    });

    const ask = () => {
      // the question itself has to reach the terminal, so unmute around writing it
      muted = false;
      rl.question(`${message}: `, (answer) => {
        if (answer === '') {
          ask();
          return;
        }
        answered = true;
        restore();
        stderr.write('\n');
        rl.close();
        resolve(answer);
      });
      muted = true;
    };

    ask();
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
    const { flags } = await this.parse<CommonFlags, OutputFlags<any>, OutputArgs<any>>(<any>this.constructor);
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
