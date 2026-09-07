import GoogleSheet from './google-sheet';

/**
 * The single place a command gets its `GoogleSheet` from.
 *
 * The commands used to call `new GoogleSheet()` inline, which left a test no way to run one
 * without a Google service account. Tests replace this export by import
 * (`factory.createGoogleSheet = () => fake`), so there is deliberately no environment variable
 * or other production switch that changes what a real run gets.
 *
 * @returns {GoogleSheet}
 */
export const createGoogleSheet = (): GoogleSheet => new GoogleSheet();

export default createGoogleSheet;
