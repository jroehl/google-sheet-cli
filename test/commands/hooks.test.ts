import { addTestData, addTestWorksheets, hasCredentials, removeTestWorksheets } from './helper';

// The command suite talks to the shared test spreadsheet. With no credentials in the environment
// there is nothing to set up and nothing to tear down, and failing here buried the real cause in
// an authentication error from deep inside googleapis.
before('Initialize worksheets', async () => {
  if (!hasCredentials) {
    console.log('No GSHEET credentials in the environment, skipping the live worksheet setup');
    return;
  }
  await addTestData();
  await addTestWorksheets();
});

after('Tear down worksheets', async () => {
  if (!hasCredentials) return;
  await removeTestWorksheets();
});
