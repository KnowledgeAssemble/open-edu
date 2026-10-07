import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBytes, fetchJson, isFetchTimeout } from './fetch-manifest.js';

function okResponse(body: ArrayBuffer | ArrayBufferView = new ArrayBuffer(0)): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      body instanceof ArrayBuffer
        ? body
        : body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
  } as unknown as Response;
}

function notOkResponse(status: number): Response {
  return { ok: false, status } as unknown as Response;
}

function jsonResponse(data: unknown): Response {
  const text = JSON.stringify(data);
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
}

describe('fetchBytes', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it('returns ArrayBuffer on success', async () => {
    const expected = new ArrayBuffer(8);
    mockFetch.mockResolvedValue(okResponse(expected));

    const result = await fetchBytes(
      'https://example.com/file',
      {},
      mockFetch as unknown as typeof fetch,
    );
    expect(result).toBe(expected);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/file', {});
  });

  it('throws Error on HTTP failure', async () => {
    mockFetch.mockResolvedValue(notOkResponse(404));

    await expect(
      fetchBytes('https://example.com/file', {}, mockFetch as unknown as typeof fetch),
    ).rejects.toThrow('HTTP 404');
  });

  it('throws with kind=timeout when AbortError is thrown', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    await expect(
      fetchBytes('https://example.com/file', {}, mockFetch as unknown as typeof fetch),
    ).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('retries once on TypeError and returns result on second call', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(okResponse(new ArrayBuffer(4)));

    const result = await fetchBytes(
      'https://example.com/file',
      {},
      mockFetch as unknown as typeof fetch,
    );
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws the second TypeError when both calls fail', async () => {
    const err1 = new TypeError('fetch failed');
    const err2 = new TypeError('fetch failed again');
    mockFetch.mockRejectedValueOnce(err1).mockRejectedValueOnce(err2);

    await expect(
      fetchBytes('https://example.com/file', {}, mockFetch as unknown as typeof fetch),
    ).rejects.toBe(err2);
  });
});

describe('fetchJson', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it('parses JSON response correctly', async () => {
    const data = { hello: 'world', count: 42 };
    mockFetch.mockResolvedValue(jsonResponse(data));

    const result = await fetchJson(
      'https://example.com/data.json',
      {},
      mockFetch as unknown as typeof fetch,
    );
    expect(result).toEqual(data);
  });

  it('throws "Invalid JSON" on non-JSON response', async () => {
    const html = new TextEncoder().encode('<!doctype html>');
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => html.buffer,
    } as unknown as Response);

    await expect(
      fetchJson('https://example.com/data.json', {}, mockFetch as unknown as typeof fetch),
    ).rejects.toThrow('Invalid JSON');
  });

  it('uses AbortSignal.timeout when no signal is provided', async () => {
    const data = { ok: true };
    mockFetch.mockResolvedValue(jsonResponse(data));

    await fetchJson('https://example.com/data.json', {}, mockFetch as unknown as typeof fetch);

    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('preserves existing signal when provided', async () => {
    const controller = new AbortController();
    const data = { ok: true };
    mockFetch.mockResolvedValue(jsonResponse(data));

    await fetchJson(
      'https://example.com/data.json',
      { signal: controller.signal },
      mockFetch as unknown as typeof fetch,
    );

    const init = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(init.signal).toBe(controller.signal);
  });
});

describe('isFetchTimeout', () => {
  it('returns true for { kind: "timeout" }', () => {
    expect(isFetchTimeout({ kind: 'timeout' })).toBe(true);
  });

  it('returns false for other objects', () => {
    expect(isFetchTimeout({ kind: 'other' })).toBe(false);
    expect(isFetchTimeout({})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFetchTimeout(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFetchTimeout(undefined)).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isFetchTimeout('timeout')).toBe(false);
  });
});
