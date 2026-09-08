import { expect } from 'chai';
import { PassThrough } from 'stream';
import { hiddenPrompt } from '../src/lib/base-class';

/**
 * `hiddenPrompt` replaces `ux.prompt(msg, { type: 'hide' })`, which core 5 dropped along with its
 * `password-prompt` dependency. Three parts of what that dependency did are asserted here, because
 * losing any of them is silent: the prompt stays off stdout, an empty answer is refused rather than
 * passed on as an empty credential, and the muted `write` is put back even when the prompt is
 * aborted.
 *
 * What is not covered: the real terminal path. These tests drive a `PassThrough` as stdin rather
 * than a tty, so raw-mode echo suppression itself is exercised only through the mute, not against
 * a terminal that would otherwise echo.
 */

const withFakeStdin = async <T>(fn: (stdin: PassThrough) => Promise<T>): Promise<T> => {
  const original = Object.getOwnPropertyDescriptor(process, 'stdin')!;
  const stdin = new PassThrough();
  Object.defineProperty(process, 'stdin', { configurable: true, value: stdin });
  try {
    return await fn(stdin);
  } finally {
    Object.defineProperty(process, 'stdin', original);
  }
};

/** Swap stderr's and stdout's `write` for recorders; whatever `hiddenPrompt` restores must be these. */
const recordStreams = () => {
  const stderr: string[] = [];
  const stdout: string[] = [];
  const originals = {
    stderr: process.stderr.write,
    stdout: process.stdout.write,
  };
  const stderrWrite = ((chunk: any) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  const stdoutWrite = ((chunk: any) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = stderrWrite;
  process.stdout.write = stdoutWrite;
  return {
    stderr,
    stdout,
    stderrWrite,
    stdoutWrite,
    restore: () => {
      process.stderr.write = originals.stderr;
      process.stdout.write = originals.stdout;
    },
  };
};

describe('hiddenPrompt', () => {
  it('asks again when the answer is empty, and resolves with the first non-empty one', async () => {
    const streams = recordStreams();
    try {
      const answer = await withFakeStdin(async (stdin) => {
        const pending = hiddenPrompt('What is your client email?');
        setImmediate(() => {
          stdin.write('\n');
          setImmediate(() => stdin.write('someone@example.com\n'));
        });
        return pending;
      });
      expect(answer).to.equal('someone@example.com');
      // the question was asked twice: once for the empty answer, once for the real one
      const asked = streams.stderr.filter((s) => s.includes('What is your client email?'));
      expect(asked.length).to.equal(2);
    } finally {
      streams.restore();
    }
  });

  it('writes the prompt to stderr and nothing at all to stdout', async () => {
    const streams = recordStreams();
    try {
      await withFakeStdin(async (stdin) => {
        const pending = hiddenPrompt('What is your private key?');
        setImmediate(() => stdin.write('a-key\n'));
        return pending;
      });
      expect(streams.stderr.join('')).to.contain('What is your private key?');
      expect(streams.stdout.join('')).to.equal('');
    } finally {
      streams.restore();
    }
  });

  it('does not echo the answer back', async () => {
    const streams = recordStreams();
    try {
      await withFakeStdin(async (stdin) => {
        const pending = hiddenPrompt('What is your private key?');
        setImmediate(() => stdin.write('super-secret\n'));
        return pending;
      });
      expect(streams.stderr.join('')).to.not.contain('super-secret');
    } finally {
      streams.restore();
    }
  });

  it('restores the muted write once the answer is in', async () => {
    const streams = recordStreams();
    try {
      await withFakeStdin(async (stdin) => {
        const pending = hiddenPrompt('What is your client email?');
        setImmediate(() => stdin.write('someone@example.com\n'));
        return pending;
      });
      expect(process.stderr.write).to.equal(streams.stderrWrite);
    } finally {
      streams.restore();
    }
  });

  it('rejects and restores the muted write when the prompt is aborted', async () => {
    const streams = recordStreams();
    try {
      const error = await withFakeStdin(async (stdin) => {
        const pending = hiddenPrompt('What is your client email?');
        setImmediate(() => stdin.end());
        return pending.then(
          () => undefined,
          (err: Error) => err,
        );
      });
      expect(error).to.be.an.instanceOf(Error);
      expect((error as Error).message).to.equal('No input');
      expect(process.stderr.write).to.equal(streams.stderrWrite);
    } finally {
      streams.restore();
    }
  });
});
