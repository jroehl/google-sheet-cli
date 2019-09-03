import { expect } from '@oclif/test';
import { testRun, WORKSHEET_TITLE_DELETE as worksheetTitle } from '../helper';

const baseCommand = 'data:update';

describe(baseCommand, () => {
  testRun([baseCommand, '[["1", "2"], ["foo"]]'], worksheetTitle, async (stdout: string) => {
    expect(stdout).to.contain(`Data successfully updated in "${worksheetTitle}"`);
  });
  testRun([baseCommand, '[["1", "2"], ["foo"]]', '--rawOutput'], worksheetTitle, async (parsed: {}) => {
    expect(parsed).to.eql({
      worksheetTitle,
      data: [['1', '2'], ['foo']],
    });
  });
});
