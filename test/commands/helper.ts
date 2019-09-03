import { test } from '@oclif/test';

export const WORKSHEET_TITLE_CHANGE = '<do-not-change>';
export const WORKSHEET_TITLE_DELETE = '<do-not-delete>';
export const WORKSHEET_TITLE_ADD = '<test-add>';
export const WORKSHEET_TITLE_REMOVE = '<test-remove>';
export const SPREADSHEET_ID = process.env.TEST_SPREADSHEET_ID;

export const getCmd = (parts: string[], worksheetTitle?: string): string[] => {
  const [base, ...commands] = parts;
  return [base, `--spreadsheetId=${SPREADSHEET_ID}`, worksheetTitle ? `--worksheetTitle=${worksheetTitle}` : '', ...commands].filter(Boolean);
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
    .it(`runs "${parsedCommand.join(' ')}"`, ctx => {
      if (!commandString.includes('--rawOutput')) {
        cb(ctx.stdout);
        return;
      }
      try {
        cb(JSON.parse(ctx.stdout));
      } catch (error) {
        throw ctx.stdout;
      }
    });
};
