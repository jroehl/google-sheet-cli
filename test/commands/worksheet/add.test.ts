import { expect } from '@oclif/test';
import { sheets_v4 } from 'googleapis';
import { testRun, WORKSHEET_ADD as worksheetTitle } from '../helper';

const baseCommand = 'worksheet:add';

describe(baseCommand, () => {
  testRun([baseCommand, '--rawOutput'], { worksheetTitle }, (parsed: sheets_v4.Schema$Sheet) => {
    if (!parsed.properties) throw parsed;
    expect(parsed.properties.title).to.equal(worksheetTitle);
    expect(parsed.properties).to.haveOwnProperty('sheetId');
    expect(parsed.properties).to.haveOwnProperty('sheetType');
    expect(parsed.properties).to.haveOwnProperty('index');
    expect(parsed.properties).to.haveOwnProperty('gridProperties');
  });
});
