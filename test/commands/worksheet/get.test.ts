import { expect } from '@oclif/test';
import { testRun, WORKSHEET_TITLE_DELETE as worksheetTitle } from '../helper';
import { sheets_v4 } from 'googleapis';

const baseCommand = 'worksheet:get';
const sheetId = 1743208699;

describe(baseCommand, () => {
  testRun([baseCommand], worksheetTitle, (stdout: string) => {
    expect(stdout).to.contain(`Fetched "${worksheetTitle}" (${sheetId})`);
  });
  testRun([baseCommand, '--rawOutput'], worksheetTitle, (parsed: sheets_v4.Schema$Sheet) => {
    if (!parsed.properties) throw parsed;
    expect(parsed.properties.sheetId).to.equal(sheetId);
    expect(parsed.properties.title).to.equal(worksheetTitle);
    expect(parsed.properties.sheetType).to.equal('GRID');
    expect(parsed.properties.sheetId).to.equal(sheetId);
  });
});
