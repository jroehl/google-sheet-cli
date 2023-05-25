import { expect } from '@oclif/test';
import { sheets_v4 } from 'googleapis';
import { testRun, WORKSHEET_GET as worksheetTitle } from '../helper';

const baseCommand = 'worksheet:get';

describe(baseCommand, () => {
  testRun([baseCommand], { worksheetTitle }, (stdout: string) => {
    expect(stdout).to.contain(`Fetched "${worksheetTitle}" (`);
  });
  testRun([baseCommand, '--rawOutput'], { worksheetTitle }, (parsed: sheets_v4.Schema$Sheet) => {
    if (!parsed.properties) throw parsed;
    expect(parsed.properties.sheetId).to.not.be.undefined;
    expect(parsed.properties.title).to.equal(worksheetTitle);
    expect(parsed.properties.sheetType).to.equal('GRID');
  });
});
