/**
 * Write one namespaced line to stderr. A gated message only appears when DEBUG names the
 * namespace; an ungated one always does, for things the caller has to know without asking.
 *
 * @param {string} namespace
 * @param {string} message
 * @param {boolean} [gated=false]
 * @returns {void}
 */
export const log = (namespace: string, message: string, gated = false): void => {
  const namespaces = (process.env.DEBUG || '').split(/[\s,]+/);
  if (gated && !namespaces.some((it) => it === '*' || it === 'gsheet:*' || it === namespace)) return;
  process.stderr.write(`${namespace} ${message}\n`);
};
