import { expect } from '@oclif/test';
import { testRun, DATA_APPEND as worksheetTitle } from '../helper';

const baseCommand = 'data:append';

const DATA = [
  ['1', '2'],
  ['foo', ''],
];
const DATA_STRING = JSON.stringify(DATA);

describe(baseCommand, () => {
  testRun([baseCommand, DATA_STRING], { worksheetTitle }, (stdout: string) => {
    expect(stdout).to.contain(`Data successfully appended to "${worksheetTitle}"`);
  });
  testRun([baseCommand, DATA_STRING, '--rawOutput'], { worksheetTitle }, (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:append',
      worksheetTitle,
      data: DATA,
    });
  });
  testRun(['data:get', '--rawOutput'], { worksheetTitle }, (parsed: {}) => {
    expect((parsed as any).rawData).to.eql([...DATA, ...DATA]);
  });
});
