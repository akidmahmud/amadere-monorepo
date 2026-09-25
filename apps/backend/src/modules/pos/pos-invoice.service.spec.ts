import { PosInvoiceService, sanitizeTemplate } from './pos-invoice.service';

describe('sanitizeTemplate', () => {
  it('strips scripts, event handlers and javascript: URLs', () => {
    const out = sanitizeTemplate(
      '<div onclick="steal()">{{storeName}}<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a></div>',
    );
    expect(out).not.toMatch(/<script|onerror|onclick|javascript:/i);
    expect(out).toContain('{{storeName}}');
  });

  it('keeps <style>, tables and every {{tag}}', () => {
    const html =
      '<style>.r{font:12px monospace}</style><table class="r"><tbody>{{itemsRows}}</tbody></table><p>{{total}}</p>';
    const out = sanitizeTemplate(html);
    expect(out).toContain('<style>');
    expect(out).toContain('{{itemsRows}}');
    expect(out).toContain('{{total}}');
    expect(out).toContain('<table');
  });
});

describe('PosInvoiceService.resolve', () => {
  function svc(rows: { storeId: number | null; html: string }[]) {
    const prisma = {
      client: {
        posInvoiceTemplate: {
          findFirst: jest.fn(
            ({ where }: { where: { storeId: number | null } }) =>
              Promise.resolve(
                rows.find((r) => r.storeId === where.storeId) ?? null,
              ),
          ),
        },
      },
    };
    return new PosInvoiceService(prisma as never);
  }

  it("uses the store's own template first", async () => {
    expect(
      await svc([
        { storeId: 2, html: 'S' },
        { storeId: null, html: 'D' },
      ]).resolve(2),
    ).toEqual({ html: 'S', source: 'store' });
  });

  it('falls back to the Default template', async () => {
    expect(await svc([{ storeId: null, html: 'D' }]).resolve(2)).toEqual({
      html: 'D',
      source: 'default',
    });
  });

  it('falls back to the built-in template when none are saved', async () => {
    expect(await svc([]).resolve(2)).toEqual({ html: null, source: 'builtin' });
  });
});

describe('PosInvoiceService.save', () => {
  it('stores sanitised HTML for the store (Default = storeId null)', async () => {
    const upsert = jest.fn();
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn();
    const prisma = {
      client: {
        posInvoiceTemplate: { upsert, findFirst, create, update: jest.fn() },
      },
    };
    const s = new PosInvoiceService(prisma as never);
    await s.save(3, '<p>{{total}}</p><script>x</script>', 7);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: 3 },
        create: expect.objectContaining({
          storeId: 3,
          html: '<p>{{total}}</p>',
          updatedById: 7,
        }),
      }),
    );
    await s.save(null, '<p>d</p>', 7);
    expect(create).toHaveBeenCalledWith({
      data: { storeId: null, html: '<p>d</p>', updatedById: 7 },
    });
  });
});

describe('sanitizeTemplate — row tags keep their place inside tables', () => {
  it('a {{row}} tag between table rows is not moved out of the table', () => {
    const out = sanitizeTemplate(
      '<table><tbody><tr><td>A {{subtotal}}</td></tr>{{vatRow}}\n{{changeRow}}<tr><td>B</td></tr></tbody></table>',
    );
    const a = out.indexOf('A {{subtotal}}');
    const vat = out.indexOf('{{vatRow}}');
    const change = out.indexOf('{{changeRow}}');
    const b = out.indexOf('>B<');
    expect(a).toBeGreaterThan(-1);
    expect(vat).toBeGreaterThan(a);
    expect(change).toBeGreaterThan(vat);
    expect(b).toBeGreaterThan(change);
    expect(out).not.toContain('data-pos-tag');
  });

  it('tags inside cells and outside tables are untouched', () => {
    const out = sanitizeTemplate(
      '<p>{{storeName}}</p><table><tr><td>{{total}}</td></tr></table>',
    );
    expect(out).toContain('<p>{{storeName}}</p>');
    expect(out).toContain('<td>{{total}}</td>');
  });
});
