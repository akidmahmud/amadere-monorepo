import { ProductsService } from './products.service';

// Re-labelling a variant (500 gram → 250 gram) keeps its id; only the links move.
describe('ProductsService.updateVariantAttributes', () => {
  function build() {
    const client = {
      product: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          attributes: [{ attributeId: 5 }],
          variants: [
            { id: 10, attributeValues: [{ attributeValueId: 50 }] },
            { id: 11, attributeValues: [{ attributeValueId: 51 }] },
          ],
        }),
      },
      attributeValue: {
        findMany: jest.fn(({ where }: { where: { id: { in: number[] } } }) =>
          Promise.resolve(where.id.in.map((id) => ({ id, attributeId: 5 }))),
        ),
      },
      productVariantAttributeValue: {
        deleteMany: jest.fn().mockReturnValue('del'),
        createMany: jest.fn().mockReturnValue('add'),
      },
      $transaction: jest.fn(),
    };
    const svc = new ProductsService({ client } as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    return { svc, client };
  }

  it('swaps the option links in one transaction', async () => {
    const { svc, client } = build();
    await svc.updateVariantAttributes(1, 10, [52]);
    expect(client.productVariantAttributeValue.deleteMany).toHaveBeenCalledWith({ where: { variantId: 10 } });
    expect(client.productVariantAttributeValue.createMany).toHaveBeenCalledWith({
      data: [{ variantId: 10, attributeValueId: 52 }],
    });
    expect(client.$transaction).toHaveBeenCalledWith(['del', 'add']);
  });

  it('refuses an option another variant already has', async () => {
    const { svc, client } = build();
    await expect(svc.updateVariantAttributes(1, 10, [51])).rejects.toThrow(/already has these options/);
    expect(client.$transaction).not.toHaveBeenCalled();
  });

  it('refuses two options on the same attribute', async () => {
    const { svc } = build();
    await expect(svc.updateVariantAttributes(1, 10, [52, 53])).rejects.toThrow(/one option per attribute/);
  });

  it('refuses a variant of another product', async () => {
    const { svc } = build();
    await expect(svc.updateVariantAttributes(1, 99, [52])).rejects.toThrow(/Variant not found/);
  });
});
