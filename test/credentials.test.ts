import { expect } from 'chai';
import { generateKeyPairSync } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { normalizeCredentials } from '../src/lib/credentials';

const CLIENT_EMAIL = 'test@test.iam.gserviceaccount.com';
const FILE_EMAIL = 'file@test.iam.gserviceaccount.com';

const BEGIN_END_MESSAGE = 'private_key must be the full PEM private_key from the service account JSON, including the BEGIN and END lines';
const INVALID_KEY_MESSAGE =
  'private_key is not a valid service account RSA key. Copy the private_key value verbatim from the service account JSON; run with DEBUG=gsheet:credentials for the parser error';

// What Google actually puts in the service account JSON.
const { privateKey: rsaKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// The same kind of key converted to PKCS#1, which Google authenticates just as well.
const { privateKey: pkcs1Key } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const { privateKey: ecKey } = generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const { privateKey: encryptedKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'hunter2' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

// A PEM with intact BEGIN/END lines but a body far too short to be a key.
const pemLines = rsaKey.trim().split('\n');
const MANGLED_KEY = [pemLines[0], pemLines[1].slice(0, 16), pemLines[pemLines.length - 1]].join('\n');

let dir: string;

const write = (name: string, contents: unknown): string => {
  const path = join(dir, name);
  writeFileSync(path, typeof contents === 'string' ? contents : JSON.stringify(contents));
  return path;
};

const expectThrows = (fn: () => unknown): Error => {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected normalizeCredentials to throw');
};

describe('normalizeCredentials', () => {
  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'gsheet-credentials-'));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('[1] uses the credentials file when no explicit values are given', () => {
    const credentialsFile = write('file-only.json', { client_email: CLIENT_EMAIL, private_key: rsaKey });
    expect(normalizeCredentials({ credentialsFile })).to.eql({ client_email: CLIENT_EMAIL, private_key: rsaKey });
  });

  it('[2] uses the explicit values when no credentials file is given', () => {
    expect(normalizeCredentials({ client_email: CLIENT_EMAIL, private_key: rsaKey })).to.eql({ client_email: CLIENT_EMAIL, private_key: rsaKey });
  });

  it('[3] lets an explicit client_email win over the credentials file', () => {
    const credentialsFile = write('partial-email.json', { client_email: FILE_EMAIL, private_key: rsaKey });
    expect(normalizeCredentials({ client_email: CLIENT_EMAIL, credentialsFile })).to.eql({ client_email: CLIENT_EMAIL, private_key: rsaKey });
  });

  it('[4] lets an explicit private_key win while the email comes from the credentials file', () => {
    const credentialsFile = write('partial-key.json', { client_email: FILE_EMAIL, private_key: pkcs1Key });
    expect(normalizeCredentials({ private_key: rsaKey, credentialsFile })).to.eql({ client_email: FILE_EMAIL, private_key: rsaKey });
  });

  it('[5] leaves a field missing from the credentials file undefined', () => {
    const credentialsFile = write('missing-fields.json', { private_key: rsaKey });
    expect(normalizeCredentials({ credentialsFile })).to.eql({ client_email: undefined, private_key: rsaKey });
  });

  it('[6] rejects a non-string private_key in the credentials file', () => {
    const credentialsFile = write('non-string-key.json', { client_email: CLIENT_EMAIL, private_key: { key: rsaKey } });
    const { message } = expectThrows(() => normalizeCredentials({ credentialsFile }));
    expect(message).to.equal(`Cannot read credentials file ${credentialsFile}: private_key must be a string`);
  });

  it('[7] rejects a non-string client_email in the credentials file', () => {
    const credentialsFile = write('non-string-email.json', { client_email: ['a@b.iam.gserviceaccount.com'], private_key: rsaKey });
    const { message } = expectThrows(() => normalizeCredentials({ credentialsFile }));
    expect(message).to.equal(`Cannot read credentials file ${credentialsFile}: client_email must be a string`);
  });

  it('[8] wraps a missing credentials file', () => {
    const credentialsFile = join(dir, 'does-not-exist.json');
    const { message } = expectThrows(() => normalizeCredentials({ credentialsFile }));
    expect(message).to.contain(`Cannot read credentials file ${credentialsFile}: `);
    expect(message).to.contain('ENOENT');
  });

  it('[9] wraps an unparsable credentials file', () => {
    const credentialsFile = write('broken.json', '{ not json');
    const { message } = expectThrows(() => normalizeCredentials({ credentialsFile }));
    expect(message).to.contain(`Cannot read credentials file ${credentialsFile}: `);
  });

  it('[10] strips quotes and padding from the credentials file path', () => {
    const credentialsFile = write('quoted-path.json', { client_email: CLIENT_EMAIL, private_key: rsaKey });
    expect(normalizeCredentials({ credentialsFile: `  "${credentialsFile}"  ` })).to.eql({ client_email: CLIENT_EMAIL, private_key: rsaKey });
  });

  it('[11] rejects a private key without the BEGIN line', () => {
    const private_key = rsaKey.replace('-----BEGIN PRIVATE KEY-----\n', '');
    expect(expectThrows(() => normalizeCredentials({ client_email: CLIENT_EMAIL, private_key })).message).to.equal(BEGIN_END_MESSAGE);
  });

  it('[12] turns literal newline escapes into newlines', () => {
    const private_key = rsaKey.replace(/\n/g, '\\n');
    expect(normalizeCredentials({ client_email: CLIENT_EMAIL, private_key })).to.eql({ client_email: CLIENT_EMAIL, private_key: rsaKey });
  });

  it('[13] strips surrounding quotes from both values', () => {
    const private_key = `'${rsaKey.replace(/\n/g, '\\n')}'`;
    expect(normalizeCredentials({ client_email: `"${CLIENT_EMAIL}"`, private_key })).to.eql({ client_email: CLIENT_EMAIL, private_key: rsaKey });
  });

  it('[14] rejects the private key id pasted instead of the private key', () => {
    const private_key = '9b2c1f4e8a7d6c5b4a39281706f5e4d3c2b1a098';
    expect(expectThrows(() => normalizeCredentials({ client_email: CLIENT_EMAIL, private_key })).message).to.equal(BEGIN_END_MESSAGE);
  });

  it('[15] rejects a bare base64 body with no PEM lines around it', () => {
    const private_key = pemLines.slice(1, -1).join('\n');
    expect(expectThrows(() => normalizeCredentials({ client_email: CLIENT_EMAIL, private_key })).message).to.equal(BEGIN_END_MESSAGE);
  });

  it('[16] rejects a private key with a mangled body', () => {
    expect(expectThrows(() => normalizeCredentials({ client_email: CLIENT_EMAIL, private_key: MANGLED_KEY })).message).to.equal(INVALID_KEY_MESSAGE);
  });

  it('[17] keeps the openssl cause out of the error message', () => {
    const { message } = expectThrows(() => normalizeCredentials({ client_email: CLIENT_EMAIL, private_key: MANGLED_KEY }));
    expect(message).to.not.contain('DECODER');
    expect(message).to.not.contain('error:');
  });

  it('[18] rejects a private key that is not an RSA key', () => {
    expect(expectThrows(() => normalizeCredentials({ client_email: CLIENT_EMAIL, private_key: ecKey })).message).to.equal(INVALID_KEY_MESSAGE);
  });

  it('[19] rejects a passphrase protected key without leaking the openssl cause', () => {
    const { message } = expectThrows(() => normalizeCredentials({ client_email: CLIENT_EMAIL, private_key: encryptedKey }));
    expect(message).to.equal(INVALID_KEY_MESSAGE);
    expect(message).to.not.contain('error:');
  });

  it('[20] accepts a valid PKCS#8 RSA key', () => {
    expect(normalizeCredentials({ client_email: CLIENT_EMAIL, private_key: rsaKey })).to.eql({ client_email: CLIENT_EMAIL, private_key: rsaKey });
  });

  it('[21] accepts a PKCS#1 RSA key', () => {
    expect(normalizeCredentials({ client_email: CLIENT_EMAIL, private_key: pkcs1Key })).to.eql({ client_email: CLIENT_EMAIL, private_key: pkcs1Key });
  });
});
