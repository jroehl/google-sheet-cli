import { expect } from '@oclif/test';
import { testRun, DATA_UPDATE as worksheetTitle } from '../helper';

const baseCommand = 'data:update';

const DATA = [['1', '2'], ['foo']];
const DATA_STRING = JSON.stringify(DATA);

describe(baseCommand, () => {
  testRun([baseCommand, DATA_STRING], { worksheetTitle }, async (stdout: string) => {
    expect(stdout).to.contain(`Data successfully updated in "${worksheetTitle}"`);
  });
  testRun([baseCommand, DATA_STRING, '--rawOutput'], { worksheetTitle }, async (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:update',
      worksheetTitle,
      data: DATA,
    });
  });
});
