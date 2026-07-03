export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface UploadedObject {
  url: string;
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
  delete(key: string): Promise<void>;
}
