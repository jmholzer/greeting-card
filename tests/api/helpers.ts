import prisma from '@/lib/prisma';
import { defaultSize, findFreeSpot } from '@/lib/geometry';
import type { Geometry } from '@/lib/geometry';
import { getMessages } from '@/utils/messages';
import { POST } from '@/app/api/message/route';
import { DELETE as ownerDelete, PATCH } from '@/app/api/message/[id]/route';
import { DELETE as adminDeleteRoute } from '@/app/api/admin/messages/[id]/route';

export const HOST = 'card.test';
export const DEFAULT_IP = '203.0.113.1';

interface RequestOptions {
  ip?: string;
  token?: string;
  origin?: string | null;
  contentType?: string;
  /** Sent as is instead of the JSON body. */
  rawBody?: string;
}

export function jsonRequest(method: string, path: string, body?: unknown, options: RequestOptions = {}) {
  const headers: Record<string, string> = {
    host: HOST,
    'content-type': options.contentType ?? 'application/json',
    'x-vercel-forwarded-for': options.ip ?? DEFAULT_IP,
  };
  if (options.origin !== null) headers.origin = options.origin ?? `http://${HOST}`;
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  const payload = options.rawBody ?? (body === undefined ? undefined : JSON.stringify(body));
  return new Request(`http://${HOST}${path}`, { method, headers, body: payload });
}

const params = (id: number | string) => ({ params: Promise.resolve({ id: String(id) }) });

export const postMessage = (body: unknown, options?: RequestOptions) =>
  POST(jsonRequest('POST', '/api/message', body, options));

export const patchMessage = (id: number | string, body: unknown, token: string, options?: RequestOptions) =>
  PATCH(jsonRequest('PATCH', `/api/message/${id}`, body, { ...options, token }), params(id));

export const deleteMessage = (id: number | string, token: string, options?: RequestOptions) =>
  ownerDelete(jsonRequest('DELETE', `/api/message/${id}`, undefined, { ...options, token }), params(id));

export const adminDelete = (id: number | string, token: string | undefined, options?: RequestOptions) =>
  adminDeleteRoute(jsonRequest('DELETE', `/api/admin/messages/${id}`, undefined, { ...options, token }), params(id));

/** A free spot for this text, given what is in the database now, worked out by the real rules. */
export async function freeSpot(text: string, others?: Geometry[]): Promise<Geometry> {
  const taken = others ?? (await getMessages()).map((message) => message.box);
  const spot = findFreeSpot(taken, defaultSize(text.length), undefined, text);
  if (!spot) throw new Error('No free spot left for the test message.');
  return spot;
}

let counter = 0;

/** A valid message in a free spot, with its own request id. */
export async function validMessage(text = 'Happy birthday!', fontFamily = 'Allura') {
  counter += 1;
  return {
    text,
    fontFamily,
    requestId: `test-request-${String(counter).padStart(8, '0')}`,
    geometry: await freeSpot(text),
  };
}

/** Signs the card and returns the saved message and its edit token. */
export async function signCard(text?: string, options?: RequestOptions) {
  const response = await postMessage(await validMessage(text), options);
  if (response.status !== 201) throw new Error(`Signing failed with ${response.status}`);
  const json = await response.json();
  return { id: json.message.id as number, token: json.editToken as string, box: json.message.box as Geometry };
}

/** A message from before free placement and edit tokens: no place and no token hash. */
export const insertLegacyMessage = (text = 'An old message') =>
  prisma.message.create({ data: { text, fontFamily: 'Allura' } });
