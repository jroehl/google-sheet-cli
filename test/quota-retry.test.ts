import { expect } from 'chai';
import GoogleSheet from '../src/lib/google-sheet';
import { FakeSheets } from './fake-sheets';

/**
 * The follow-up to #611. Sizing the grid made `updateData` read the spreadsheet before every
 * write, which roughly doubled the reads a chained job spends, and the live suite started
 * failing on the Sheets API's "Read requests per minute per user" limit. That limit is 60 and
 * cannot be raised - Google refuses a consumer override above it - so the client has to survive
 * the rejection rather than avoid it.
 *
 * gaxios was already retrying a 429: `googleapis-common` sets `retry: true` on every request and
 * 429 is in gaxios' default `statusCodesToRetry`. Measured against this fake before the change,
 * a spent quota cost four attempts in 2.1 seconds - a schedule sized for a transient 5xx, spent
 * entirely inside the minute it was waiting out, each attempt taking another unit of the quota.
 * What these cases pin is the length of the wait, and that it ends.
 */

const SPREADSHEET_ID = 'fake-spreadsheet-id';
const SPREADSHEET_TITLE = 'Quota spreadsheet';
const SHEET = 'Data';

/** the schedule, in ms: 63 seconds, so the last attempt is made after the rejected minute rolled */
const SCHEDULE = [3000, 12000, 48000];

interface Attempt {
  /** every delay the call asked to wait, in the order it asked */
  delays: number[];
  /** what the library wrote to stderr while it ran */
  stderr: string;
  error?: any;
  value?: any;
}

/**
 * Run a call with every `setTimeout` collapsed to no wait, and report what it asked for.
 *
 * Waiting out the backoff for real would take 63 seconds, which is the point of it and no way to
 * run a test, so the delays are asserted on instead of served. Nothing else in a request through
 * `FakeSheets` sets a timer - a successful call sets none - so collapsing every one of them
 * changes nothing but the sleeping.
 *
 * @param {() => Promise<any>} fn
 * @returns {Promise<Attempt>}
 */
const run = async (fn: () => Promise<any>): Promise<Attempt> => {
  const delays: number[] = [];
  const realSetTimeout = global.setTimeout;
  const realWrite = process.stderr.write;
  let stderr = '';

  const collapsed: any = (handler: any, ms?: number, ...args: any[]) => {
    delays.push(ms ?? 0);
    return (realSetTimeout as any)(handler, 0, ...args);
  };
  Object.assign(collapsed, realSetTimeout);

  (global as any).setTimeout = collapsed;
  (process.stderr as any).write = (chunk: any): boolean => {
    stderr += String(chunk);
    return true;
  };

  try {
    // `stderr` has to be read after the call, not while the result object is being built
    const value = await fn();
    return { delays, stderr, value };
  } catch (error) {
    return { delays, stderr, error };
  } finally {
    (global as any).setTimeout = realSetTimeout;
    (process.stderr as any).write = realWrite;
  }
};

describe('quota rejections', () => {
  const fake = new FakeSheets();
  let gsheet: GoogleSheet;

  /** every request that reached the Sheets API, tokens and other hosts excluded */
  const attempts = (): string[] => fake.requests.filter((it) => it.url.includes('/v4/spreadsheets')).map((it) => it.method);

  before(() => fake.install());
  after(() => fake.uninstall());

  beforeEach(async () => {
    fake.reset();
    fake.addSpreadsheet(SPREADSHEET_ID, SPREADSHEET_TITLE, [{ title: SHEET, rowCount: 10, columnCount: 5 }]);
    gsheet = new GoogleSheet(SPREADSHEET_ID);
    await gsheet.authorize(fake.credentials);
  });

  it('completes a read the api rejected once for quota', async () => {
    fake.rejectWithQuota(1);

    const { error, value, delays, stderr } = await run(() => gsheet.getSpreadsheet());

    expect(error, error?.message).to.equal(undefined);
    expect(value.properties.title).to.equal(SPREADSHEET_TITLE);
    expect(attempts()).to.deep.equal(['GET', 'GET']);
    expect(delays).to.deep.equal([SCHEDULE[0]]);
    // a 48 second pause with nothing on stderr is indistinguishable from a hang
    expect(stderr).to.contain('quota exceeded, retrying in 3s (attempt 1 of 3)');
  });

  it('completes the read a write makes, which is the call that failed live', async () => {
    fake.rejectWithQuota(1);

    const { error, delays } = await run(() => gsheet.updateData([['written']], { worksheetTitle: SHEET, minRow: 1, minCol: 1 }));

    expect(error, error?.message).to.equal(undefined);
    expect(fake.cell(SPREADSHEET_ID, SHEET, 'A1')).to.equal('written');
    expect(delays).to.deep.equal([SCHEDULE[0]]);
  });

  it('gives up on a quota that never refills, and fails with the message google sent', async () => {
    fake.rejectWithQuota(Infinity);

    const { error, delays } = await run(() => gsheet.getSpreadsheet());

    expect(error).to.be.instanceOf(Error);
    expect(error.message).to.contain("Quota exceeded for quota metric 'Read requests'");
    expect(error.status).to.equal(429);
    // bounded: three retries, the schedule spelled out, and then the call is over
    expect(delays).to.deep.equal(SCHEDULE);
    expect(attempts()).to.deep.equal(['GET', 'GET', 'GET', 'GET']);
  });

  it('leaves the next call a full budget of its own', async () => {
    fake.rejectWithQuota(Infinity);
    await run(() => gsheet.getSpreadsheet());
    fake.reset();
    fake.addSpreadsheet(SPREADSHEET_ID, SPREADSHEET_TITLE, [{ title: SHEET }]);
    fake.rejectWithQuota(Infinity);

    const { delays } = await run(() => gsheet.getSpreadsheet());

    expect(delays).to.deep.equal(SCHEDULE);
  });
});
