import { test } from '@oclif/test';
import GoogleSheet from '../../src/lib/google-sheet';

const { GSHEET_CLIENT_EMAIL: client_email = '', GSHEET_PRIVATE_KEY: private_key = '', TEST_SPREADSHEET_ID } = process.env;
export const SPREADSHEET_ID = TEST_SPREADSHEET_ID;

const ID = () => `_${Math.random().toString(36).substr(2, 9)}`;
export const getID = (prefix = '') => `${prefix}${Date.now()}${ID()}`;

export const DATA_APPEND = getID('data_append_');
export const DATA_UPDATE = getID('data_update_');
export const DATA_GET = getID('data_get_');

export const WORKSHEET_GET = getID('worksheet_get_');
export const WORKSHEET_ADD = getID('worksheet_add_');
export const WORKSHEET_REMOVE = getID('worksheet_remove_');

const authorize = async (): Promise<GoogleSheet> => {
  const gsheet = new GoogleSheet();
  await gsheet.authorize({ client_email, private_key });
  return gsheet;
};

const worksheetsToAdd = [DATA_APPEND, DATA_UPDATE, WORKSHEET_GET, WORKSHEET_REMOVE];
const worksheetsToRemove = [DATA_APPEND, DATA_UPDATE, WORKSHEET_GET, WORKSHEET_ADD, DATA_GET];

export const RAW_DATA = [
  ['A1', 'B1', 'C1'],
  ['', 'B2', 'C2'],
  ['A3', '', 'C3'],
  ['A4', 'B4', ''],
  ['A5', '', 'C5'],
  ['', 'B6', 'C6'],
  ['A7', 'B7', 'C7'],
];

export const addTestWorksheets = async () => {
  console.log('Adding test worksheets');
  const gsheet = await authorize();
  const results = await Promise.all(
    worksheetsToAdd.map(async (sheet) => {
      await gsheet.addWorksheet(sheet, SPREADSHEET_ID);
      return sheet;
    })
  );
  results.forEach((sheet) => console.log(`  - ${sheet}`));
  console.log('');
};

export const removeTestWorksheets = async () => {
  console.log('Removing test worksheets');
  const gsheet = await authorize();
  const results = await Promise.all(
    worksheetsToRemove.map(async (sheet) => {
      try {
        await gsheet.removeWorksheet(sheet, SPREADSHEET_ID);
        return sheet;
      } catch (error) {
        // fail soft
        return ((error as Error).message || error) as string;
      }
    })
  );
  results.forEach((sheet) => console.log(`  - ${sheet}`));
  console.log('');
};

export const addTestData = async () => {
  console.log('Adding test data');
  const gsheet = await authorize();
  await gsheet.addWorksheet(DATA_GET, SPREADSHEET_ID);
  await gsheet.updateData(RAW_DATA, { worksheetTitle: DATA_GET }, SPREADSHEET_ID);
  console.log(`  - ${DATA_GET}`);
  console.log('');
};

export const getCmd = (parts: string[], worksheetTitle?: string): string[] => {
  const [base, ...flags] = parts;
  return [base, `--spreadsheetId=${SPREADSHEET_ID}`, worksheetTitle ? `--worksheetTitle=${worksheetTitle}` : '', ...flags].filter(Boolean);
};

export const getRun = (parts: string[]): string => {
  return `runs "${parts.join(' ')}"`;
};

export const testRun = (cmd: string[], worksheetTitle?: string, cb: Function = () => {}) => {
  const parsedCommand = getCmd(cmd, worksheetTitle);
  const commandString = `runs "${parsedCommand.join(' ')}"`;
  test
    .stdout()
    .command(parsedCommand)
    .it(commandString, ({ stdout }) => {
      if (!commandString.includes('--rawOutput')) {
        cb(stdout);
        return;
      }
      const cleanedJSON = stdout.replace(/\r?\n|\r| /g, '');
      cb(JSON.parse(cleanedJSON));
    });
};
