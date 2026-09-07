import { expect } from 'chai';
import { sheets_v4 } from '@googleapis/sheets';
import { describeLive, SPREADSHEET_ID, testRun } from '../helper';

const baseCommand = 'spreadsheet:get';

describeLive(baseCommand, () => {
  testRun([baseCommand], undefined, (stdout: string) => {
    expect(stdout).to.contain(`Fetched spreadsheet "github-actions-test" (${SPREADSHEET_ID})`);
  });
  testRun([baseCommand, '--rawOutput'], undefined, (parsed: sheets_v4.Schema$Spreadsheet) => {
    expect(parsed.spreadsheetId).to.equal(SPREADSHEET_ID);
    expect(parsed.spreadsheetUrl).to.equal(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
    expect(parsed).to.haveOwnProperty('properties');
    expect(parsed).to.haveOwnProperty('sheets');
  });
});
