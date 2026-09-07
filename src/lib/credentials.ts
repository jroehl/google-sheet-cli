import { createPrivateKey } from 'crypto';
import { readFileSync } from 'fs';

const DEBUG_NAMESPACE = 'gsheet:credentials';

// Google only ever puts a PKCS#8 key in the service account JSON, but a key someone converted to
// PKCS#1 authenticates just as well, so createPrivateKey below is the real gate. These markers only
// catch input that is no kind of PEM at all - a key id, a bare base64 body - and say so in plainer
// words than the parser would.
const BEGIN_LINE = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/;
const END_LINE = /-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----/;

const MISSING_PEM_LINES = 'private_key must be the full PEM private_key from the service account JSON, including the BEGIN and END lines';
const NOT_AN_RSA_KEY =
  'private_key is not a valid service account RSA key. Copy the private_key value verbatim from the service account JSON; run with DEBUG=gsheet:credentials for the parser error';

export interface CredentialsInput {
  client_email?: string;
  private_key?: string;
  credentialsFile?: string;
}

export interface NormalizedCredentials {
  client_email?: string;
  private_key?: string;
}

/**
 * Log the cause of a rejected key, which is raw OpenSSL text that means nothing to most users.
 */
const debug = (message: string): void => {
  const namespaces = (process.env.DEBUG || '').split(/[\s,]+/);
  if (namespaces.some((namespace) => namespace === '*' || namespace === 'gsheet:*' || namespace === DEBUG_NAMESPACE)) {
    process.stderr.write(`${DEBUG_NAMESPACE} ${message}\n`);
  }
};

/**
 * Shells and CI secret stores hand values over with the quotes still attached.
 */
const unquote = (value: string): string => {
  const trimmed = value.trim();
  const [first, last] = [trimmed.slice(0, 1), trimmed.slice(-1)];
  if (trimmed.length > 1 && first === last && (first === '"' || first === "'")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const clean = (value?: string): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const unquoted = unquote(value);
  return unquoted === '' ? undefined : unquoted;
};

/**
 * Read the `client_email` and `private_key` out of a service account JSON file.
 *
 * @param {string} path
 * @returns {NormalizedCredentials}
 */
const readCredentialsFile = (path: string): NormalizedCredentials => {
  const fail = (cause: string): never => {
    throw new Error(`Cannot read credentials file ${path}: ${cause}`);
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return fail((error as Error).message);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail('expected a JSON object');
  }

  const { client_email, private_key } = parsed as Record<string, unknown>;
  if (client_email !== undefined && typeof client_email !== 'string') fail('client_email must be a string');
  if (private_key !== undefined && typeof private_key !== 'string') fail('private_key must be a string');

  return { client_email: client_email as string | undefined, private_key: private_key as string | undefined };
};

/**
 * Turn a pasted private key into a PEM that OpenSSL accepts, or explain what is wrong with it.
 *
 * @param {string} value
 * @returns {string}
 */
const normalizePrivateKey = (value: string): string => {
  // A key pasted into an env variable or a JSON string keeps its newlines escaped.
  const pem = `${unquote(value).replace(/\\n/g, '\n').trim()}\n`;

  if (!BEGIN_LINE.test(pem) || !END_LINE.test(pem)) {
    throw new Error(MISSING_PEM_LINES);
  }

  let key;
  try {
    key = createPrivateKey(pem);
  } catch (error) {
    debug(`createPrivateKey failed: ${(error as Error).message}`);
    throw new Error(NOT_AN_RSA_KEY);
  }

  if (key.asymmetricKeyType !== 'rsa') {
    debug(`expected an rsa key, got "${key.asymmetricKeyType}"`);
    throw new Error(NOT_AN_RSA_KEY);
  }

  return pem;
};

/**
 * Merge and validate the credentials from every source before anything hits the network.
 * An explicit value wins over the credentials file field by field; whatever is still
 * missing is left undefined for the caller to prompt for or to reject.
 *
 * @param {CredentialsInput} input
 * @returns {NormalizedCredentials}
 */
export const normalizeCredentials = (input: CredentialsInput = {}): NormalizedCredentials => {
  const credentialsFile = clean(input.credentialsFile);
  const file = credentialsFile ? readCredentialsFile(credentialsFile) : {};

  const client_email = clean(input.client_email) ?? clean(file.client_email);
  const private_key = clean(input.private_key) ?? clean(file.private_key);

  return {
    client_email,
    private_key: private_key === undefined ? undefined : normalizePrivateKey(private_key),
  };
};

export default normalizeCredentials;
