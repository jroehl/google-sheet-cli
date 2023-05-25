import { expect } from '@oclif/test';
import { sheets_v4 } from 'googleapis';
import { testRun, WORKSHEET_REMOVE as worksheetTitle } from '../helper';

const baseCommand = 'worksheet:remove';

describe(baseCommand, () => {
  testRun([baseCommand], { worksheetTitle }, (stdout: sheets_v4.Schema$Sheet) => {
    expect(stdout).to.contain(`Worksheet "${worksheetTitle}" successfully removed`);
  });
});
