import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MirroredMediaStorage } from './mirrored-media-storage';

describe('MirroredMediaStorage', () => {
  it('keeps uploads on disk while R2 is down and pushes them once it is back', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mirror-'));
    let up = false;
    const pushed: string[] = [];
    const r2 = {
      publicUrl: (k: string) => `https://cdn.test/${k}`,
      upload: jest.fn(async (k: string) => {
        if (!up) throw new Error('R2 403');
        pushed.push(k);
        return { url: `https://cdn.test/${k}` };
      }),
    };
    const storage = new MirroredMediaStorage(r2 as never, {
      get: () => dir,
    } as never);

    const res = await storage.upload('image/a.webp', Buffer.from('x'), 'image/webp');
    expect(res.url).toBe('https://cdn.test/image/a.webp');
    expect(readFileSync(path.join(dir, 'public/image/a.webp'), 'utf8')).toBe('x');

    await storage.syncPending(); // still down: stays queued
    expect(pushed).toEqual([]);

    up = true;
    await storage.syncPending();
    expect(pushed).toEqual(['image/a.webp']);
    await storage.syncPending(); // queue drained
    expect(pushed).toEqual(['image/a.webp']);
    expect(existsSync(path.join(dir, 'public/image/a.webp'))).toBe(true);
  });

  it('refuses keys that escape the mirror folder', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'mirror-'));
    const storage = new MirroredMediaStorage({} as never, { get: () => dir } as never);
    await expect(storage.upload('../x', Buffer.from('x'), 'text/plain')).rejects.toThrow('Bad media key');
  });
});
