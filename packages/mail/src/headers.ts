/**
 * CR or LF anywhere in an extra header would end it and start another one, so a
 * header value built from data (a URL, a name) must never be able to carry one.
 * Both transports call this before handing the headers to nodemailer.
 */
const HEADER_BREAK = /[\r\n]/;

/** Throws instead of letting a CR/LF in `headers` become a second header. */
export const assertSafeHeaders = (
  headers?: Record<string, string>
): Record<string, string> | undefined => {
  if (!headers) {
    return undefined;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (HEADER_BREAK.test(name) || HEADER_BREAK.test(value)) {
      throw new Error(
        `Refusing to send header ${JSON.stringify(name)}: a header name or value may not contain CR or LF`
      );
    }
  }
  return headers;
};
