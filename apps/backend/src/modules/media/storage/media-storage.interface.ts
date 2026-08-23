import type { Readable } from 'node:stream';

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface UploadedObject {
  url: string;
}

/** Deliberately returns the KEY and no URL. A digital product's PDF must never
 * have a public address — the bucket is wholly public, so a URL for it would be
 * fetchable by anyone forever, with no entitlement check. */
export interface PrivateObject {
  key: string;
}

// R2 is fixed tech (AGENTS.md §3), not a deferred-credentials provider like
// Payment/Courier — but this interface still lets the storage backend be
// swapped/mocked without touching callers.
export interface MediaStorage {
  upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<UploadedObject>;
  uploadPrivate(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<PrivateObject>;
  getObjectStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
