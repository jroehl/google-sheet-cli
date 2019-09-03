import { expect } from '@oclif/test';
import { testRun, WORKSHEET_TITLE_REMOVE as worksheetTitle } from '../helper';
import { sheets_v4 } from 'googleapis';

const baseCommand = 'worksheet:remove';

describe(baseCommand, () => {
  testRun([baseCommand], worksheetTitle, (stdout: sheets_v4.Schema$Sheet) => {
    expect(stdout).to.contain(`Worksheet "${worksheetTitle}" successfully removed`);
  });
});
