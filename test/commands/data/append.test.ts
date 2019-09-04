import { expect } from '@oclif/test';
import { testRun, WORKSHEET_TITLE_DELETE as worksheetTitle } from '../helper';

const baseCommand = 'data:append';

describe(baseCommand, () => {
  testRun([baseCommand, '[["1", "2"], ["foo"]]'], worksheetTitle, (stdout: string) => {
    expect(stdout).to.contain(`Data successfully appended to "${worksheetTitle}"`);
  });
  testRun([baseCommand, '[["1", "2"], ["foo"]]', '--rawOutput'], worksheetTitle, (parsed: {}) => {
    expect(parsed).to.eql({
      operation: 'data:append',
      worksheetTitle,
      data: [['1', '2'], ['foo']],
    });
  });
});
