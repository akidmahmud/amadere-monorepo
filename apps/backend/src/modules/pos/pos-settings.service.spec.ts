import { PosSettingsService, POS_VAT_DEFAULT } from './pos-settings.service';

describe('PosSettingsService VAT', () => {
  function svc(stored: unknown) {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      client: {
        setting: {
          findUnique: jest
            .fn()
            .mockResolvedValue(stored === undefined ? null : { value: stored }),
          upsert,
        },
      },
    };
    return { s: new PosSettingsService(prisma as never), upsert };
  }

  it('defaults when nothing is stored (15% added on top, enabled)', async () => {
    expect(await svc(undefined).s.getVat()).toEqual(POS_VAT_DEFAULT);
    expect(POS_VAT_DEFAULT).toEqual({
      enabled: true,
      ratePercent: 15,
      pricesIncludeVat: false,
    });
  });

  it('merges a partial stored value with the defaults', async () => {
    expect(await svc({ ratePercent: 5 }).s.getVat()).toEqual({
      enabled: true,
      ratePercent: 5,
      pricesIncludeVat: false,
    });
  });

  it('saves under pos.vat', async () => {
    const { s, upsert } = svc(undefined);
    const v = { enabled: false, ratePercent: 10, pricesIncludeVat: true };
    expect(await s.setVat(v)).toEqual(v);
    expect(upsert).toHaveBeenCalledWith({
      where: { key: 'pos.vat' },
      create: { key: 'pos.vat', value: v },
      update: { value: v },
    });
  });
});
