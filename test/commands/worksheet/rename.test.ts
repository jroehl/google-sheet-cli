import { expect } from 'chai';
import { sheets_v4 } from '@googleapis/sheets';
import { describeLive, WORKSHEET_RENAMED as newWorksheetTitle, testRun, WORKSHEET_RENAME as worksheetTitle } from '../helper';

const baseCommand = 'worksheet:rename';

describeLive(baseCommand, () => {
  testRun([baseCommand], { worksheetTitle, newWorksheetTitle }, (stdout: sheets_v4.Schema$Sheet) => {
    expect(stdout).to.contain(`Worksheet "${worksheetTitle}" successfully renamed to "${newWorksheetTitle}"`);
  });
});
