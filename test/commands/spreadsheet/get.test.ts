import { expect } from '@oclif/test';
import { testRun, SPREADSHEET_ID } from '../helper';
import { sheets_v4 } from 'googleapis';

const baseCommand = 'spreadsheet:get';

describe(baseCommand, () => {
  testRun([baseCommand], '', (stdout: string) => {
    expect(stdout).to.contain(`Fetched spreadsheet "github-actions-test" (${SPREADSHEET_ID})`);
  });
  testRun([baseCommand, '--rawOutput'], '', (parsed: sheets_v4.Schema$Spreadsheet) => {
    expect(parsed.spreadsheetId).to.equal(SPREADSHEET_ID);
    expect(parsed.spreadsheetUrl).to.equal(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
    expect(parsed).to.haveOwnProperty('properties');
    expect(parsed).to.haveOwnProperty('sheets');
  });
});
