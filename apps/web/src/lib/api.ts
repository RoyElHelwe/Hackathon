/** Typed fetch wrapper. All calls go through the same-origin /api proxy so the session cookie is sent. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export async function api<T = unknown>(path: string, opts: { method?: Method; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
    signal: opts.signal,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const d = (data ?? {}) as Record<string, unknown>;
    const msg = typeof d.message === 'string' ? d.message : 'Something went wrong. Please try again.';
    throw new ApiError(res.status, msg, d);
  }
  return data as T;
}

export async function uploadFile(file: Blob, filename = 'upload'): Promise<{ id: string; kind: string; mime: string }> {
  const form = new FormData();
  form.append('file', file, filename);
  const res = await fetch('/api/uploads', { method: 'POST', body: form, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.message ?? 'Upload failed', data);
  return data;
}

export const uploadUrl = (id: string) => `/api/uploads/${id}`;
