import { NotFoundException } from '@nestjs/common';
import { MediaService, rekey } from './media.service';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const BASE = 'https://cdn.test';

function make(
  opts: {
    folders?: { id: number; name: string; parentId: number | null }[];
    media?: Record<string, unknown>[];
    failCopyAt?: number;
  } = {},
) {
  let copies = 0;
  let nextFolderId = 100;
  let nextMediaId = 500;
  const storage = {
    copy: jest.fn((_from: string, to: string) => {
      copies++;
      if (opts.failCopyAt === copies)
        return Promise.reject(new Error('R2 down'));
      return Promise.resolve({ url: `${BASE}/${to}` });
    }),
    delete: jest.fn(),
  };
  const client = {
    mediaFolder: {
      findMany: jest.fn().mockResolvedValue(opts.folders ?? []),
      findUnique: jest.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(
          (opts.folders ?? []).find((f) => f.id === where.id) ?? null,
        ),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: nextFolderId++, createdAt: new Date(), ...data }),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: number };
          data: Record<string, unknown>;
        }) =>
          Promise.resolve({
            id: where.id,
            parentId: null,
            createdAt: new Date(),
            ...data,
          }),
      ),
    },
    media: {
      findMany: jest.fn().mockResolvedValue(opts.media ?? []),
      findUnique: jest.fn(),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: nextMediaId++, createdAt: new Date(), ...data }),
      ),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 1,
          url: `${BASE}/image/x.png`,
          type: 'IMAGE',
          createdAt: new Date(),
          ...data,
        }),
      ),
    },
    $transaction: jest.fn(),
  };
  client.$transaction.mockImplementation((fn: (tx: typeof client) => unknown) =>
    fn(client),
  );
  const svc = new MediaService({ client } as never, storage as never);
  return { svc, client, storage };
}

describe('rekey', () => {
  it('swaps the leading UUID and keeps the folder and file name', () => {
    expect(rekey(`image/${UUID_A}-Sorishar-tel.webp`, UUID_B)).toBe(
      `image/${UUID_B}-Sorishar-tel.webp`,
    );
    expect(rekey(`image/${UUID_A}-card.webp`, UUID_B)).toBe(
      `image/${UUID_B}-card.webp`,
    );
  });
  it('prefixes the new UUID when a key has none (legacy uploads)', () => {
    expect(rekey('image/old-banner.png', UUID_B)).toBe(
      `image/${UUID_B}-old-banner.png`,
    );
  });
});

describe('renameFolder', () => {
  it('trims and saves the new name', async () => {
    const { svc, client } = make({
      folders: [{ id: 1, name: 'Old', parentId: null }],
    });
    const r = await svc.renameFolder(1, '  Banners  ');
    expect(client.mediaFolder.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Banners' },
    });
    expect(r.name).toBe('Banners');
  });
  it('404s an unknown folder', async () => {
    const { svc } = make();
    await expect(svc.renameFolder(9, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('duplicateFolder', () => {
  const folders = [
    { id: 1, name: 'Products', parentId: null },
    { id: 2, name: 'Oils', parentId: 1 },
    { id: 3, name: 'Elsewhere', parentId: null },
  ];
  const media = [
    {
      id: 10,
      folderId: 1,
      url: `${BASE}/image/${UUID_A}-a.png`,
      cardUrl: `${BASE}/image/${UUID_A}-card.webp`,
      fullUrl: null,
      type: 'IMAGE',
      altText: 'A',
      name: 'Front',
      width: 10,
      height: 20,
    },
    {
      id: 11,
      folderId: 2,
      url: `${BASE}/video/${UUID_A}-b.mp4`,
      cardUrl: null,
      fullUrl: null,
      type: 'VIDEO',
      altText: null,
      name: null,
      width: null,
      height: null,
    },
  ];

  it('copies the whole tree: "(copy)" folder beside the original, subfolders, and every file under new keys', async () => {
    const { svc, client, storage } = make({ folders, media });
    const r = await svc.duplicateFolder(1);

    expect(r.name).toBe('Products (copy)');
    expect(client.mediaFolder.create).toHaveBeenNthCalledWith(1, {
      data: { name: 'Products (copy)', parentId: null },
    });
    expect(client.mediaFolder.create).toHaveBeenNthCalledWith(2, {
      data: { name: 'Oils', parentId: r.id },
    });
    expect(storage.copy).toHaveBeenCalledTimes(3); // a.png + its card, b.mp4
    const [fromKey, toKey] = storage.copy.mock.calls[0];
    expect(fromKey).toBe(`image/${UUID_A}-a.png`);
    expect(toKey).toMatch(/^image\/[0-9a-f-]{36}-a\.png$/);
    expect(toKey).not.toContain(UUID_A);
    const created = client.media.create.mock.calls.map(([a]) => a.data);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({
      folderId: r.id,
      altText: 'A',
      name: 'Front',
      type: 'IMAGE',
      width: 10,
      height: 20,
      fullUrl: null,
    });
    expect(created[0].url).not.toBe(media[0].url);
    expect(created[1].folderId).toBe(101); // the copied "Oils"
  });

  it('picks "(copy 2)" when "(copy)" already exists beside it', async () => {
    const { svc } = make({
      folders: [...folders, { id: 4, name: 'Products (copy)', parentId: null }],
      media: [],
    });
    expect((await svc.duplicateFolder(1)).name).toBe('Products (copy 2)');
  });

  it('removes already-copied objects and saves nothing if a storage copy fails', async () => {
    const { svc, client, storage } = make({ folders, media, failCopyAt: 3 });
    await expect(svc.duplicateFolder(1)).rejects.toThrow('R2 down');
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(client.mediaFolder.create).not.toHaveBeenCalled();
    expect(client.media.create).not.toHaveBeenCalled();
  });

  it('404s an unknown folder', async () => {
    const { svc } = make({ folders });
    await expect(svc.duplicateFolder(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('update (file display name)', () => {
  const setup = () => {
    const m = make();
    m.client.media.findUnique.mockResolvedValue({ id: 1 });
    return m;
  };
  it('trims the name', async () => {
    const { svc, client } = setup();
    await svc.update(1, { name: '  Mustard oil banner  ' });
    expect(client.media.update.mock.calls[0][0].data.name).toBe(
      'Mustard oil banner',
    );
  });
  it('an empty name clears it back to the file name', async () => {
    const { svc, client } = setup();
    await svc.update(1, { name: '   ' });
    expect(client.media.update.mock.calls[0][0].data.name).toBeNull();
  });
  it('leaves the name alone when not sent', async () => {
    const { svc, client } = setup();
    await svc.update(1, { altText: 'x' });
    expect(client.media.update.mock.calls[0][0].data.name).toBeUndefined();
  });
});
