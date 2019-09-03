import { testRun, WORKSHEET_TITLE_DELETE, WORKSHEET_TITLE_ADD, WORKSHEET_TITLE_REMOVE } from './helper';

const clean = ['data:update', '[["", ""], ["", ""], ["", ""], ["", ""]]'];

before(() => {
  testRun(clean, WORKSHEET_TITLE_DELETE);
  testRun(['worksheet:add'], WORKSHEET_TITLE_REMOVE);
  testRun(['worksheet:remove'], WORKSHEET_TITLE_ADD);
});
