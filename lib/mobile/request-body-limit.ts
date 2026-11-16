/**
 * Request-body byte limiter for public mobile JSON endpoints.
 * Enforces bytes while consuming the stream; unlike Request.text() plus
 * string.length, this prevents excess bytes from being buffered or decoded.
 * No browser/global state, cookies, tenant access or database operations here.
 */
export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body byte limit exceeded.');
    this.name = 'RequestBodyTooLargeError';
  }
}

export class InvalidRequestUtf8Error extends Error {
  constructor() {
    super('Request body was not valid UTF-8.');
    this.name = 'InvalidRequestUtf8Error';
  }
}

export async function readUtf8BodyLimited(req: Request, maxBytes: number): Promise<string> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new Error('Invalid request body limit.');
  }

  // Reject stated oversized bodies before reading; streaming checks remain
  // authoritative because Content-Length is not always supplied or accurate.
  const claimed = req.headers.get('content-length');
  if (claimed !== null && /^\d+$/.test(claimed) && Number(claimed) > maxBytes) {
    throw new RequestBodyTooLargeError();
  }

  const reader = req.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let result = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        // Cancel without buffering or decoding the rest of the stream.
        await reader.cancel().catch(() => {});
        throw new RequestBodyTooLargeError();
      }
      try {
        result += decoder.decode(value, { stream: true });
      } catch {
        throw new InvalidRequestUtf8Error();
      }
    }
    try {
      result += decoder.decode();
    } catch {
      throw new InvalidRequestUtf8Error();
    }
    return result;
  } finally {
    reader.releaseLock();
  }
}
