import { removeTestWorksheets, addTestWorksheets, addTestData } from './helper';

before('Initialize worksheets', async () => {
  await addTestData();
  await addTestWorksheets();
});

after('Tear down worksheets', async () => {
  await removeTestWorksheets();
});
