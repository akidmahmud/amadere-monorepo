import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { duplicateMessage, HttpExceptionFilter } from './http-exception.filter';

// Fake ArgumentsHost that captures the JSON body the filter writes.
function hostFor(): { host: ArgumentsHost; sent: () => any } {
  let payload: unknown;
  const response = {
    status: () => response,
    json: (b: unknown) => {
      payload = b;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, sent: () => payload };
}

describe('HttpExceptionFilter 404 sanitization', () => {
  const filter = new HttpExceptionFilter();

  it("replaces Nest's route-miss echo (leaks the /api/v1 path) with a generic message", () => {
    const { host, sent } = hostFor();
    filter.catch(
      new NotFoundException('Cannot POST /api/v1/customers/login'),
      host,
    );
    expect(sent().error.message).toBe('Not Found');
  });

  it('leaves a real application 404 message intact', () => {
    const { host, sent } = hostFor();
    filter.catch(new NotFoundException('Product not found'), host);
    expect(sent().error.message).toBe('Product not found');
  });
});

describe('duplicateMessage (Prisma P2002 → clear 409 text)', () => {
  it('names the SKU / barcode that is taken', () => {
    expect(duplicateMessage({ code: 'P2002', meta: { target: ['sku'] } })).toMatch(/This SKU already exists/);
    expect(duplicateMessage({ code: 'P2002', meta: { target: 'products_barcode_key' } })).toMatch(/This barcode already exists/);
  });
  it('ignores other errors', () => {
    expect(duplicateMessage(new Error('boom'))).toBeNull();
    expect(duplicateMessage({ code: 'P2025' })).toBeNull();
  });
});
