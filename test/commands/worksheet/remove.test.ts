import { expect } from 'chai';
import { sheets_v4 } from '@googleapis/sheets';
import { describeLive, testRun, WORKSHEET_REMOVE as worksheetTitle } from '../helper';

const baseCommand = 'worksheet:remove';

describeLive(baseCommand, () => {
  testRun([baseCommand], { worksheetTitle }, (stdout: sheets_v4.Schema$Sheet) => {
    expect(stdout).to.contain(`Worksheet "${worksheetTitle}" successfully removed`);
  });
});
