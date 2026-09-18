import { BadRequestException } from '@nestjs/common';
import { parseCourierBill } from './courier-bills';
import { CourierBillsService } from './courier-bills.service';

describe('parseCourierBill', () => {
  it('uses a total-charge column when present', () => {
    const r = parseCourierBill(
      'Consignment ID,COD Amount,Total Charge\n12345,500,135.50\n',
    );
    expect(r.rows).toEqual([{ consignmentId: '12345', charge: 135.5 }]);
  });

  it('otherwise sums delivery + COD + return charge columns', () => {
    const r = parseCourierBill(
      'consignment_id,delivery_charge,cod_charge,return_charge\n"777",105,3.15,0\n',
    );
    expect(r.rows).toEqual([{ consignmentId: '777', charge: 108.15 }]);
  });

  it('skips rows without an id or with a non-numeric charge', () => {
    const r = parseCourierBill('CID,Delivery Charge\n,100\n9,abc\n10,90\n');
    expect(r.rows).toEqual([{ consignmentId: '10', charge: 90 }]);
    expect(r.skipped).toBe(2);
  });

  it('rejects a file with no consignment or charge column', () => {
    expect(() => parseCourierBill('Name,Phone\nA,1\n')).toThrow(
      BadRequestException,
    );
  });
});

describe('CourierBillsService.import', () => {
  it('writes the billed charge onto matching shipments and reports the rest', async () => {
    const prisma = {
      client: {
        shipment: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 1, consignmentId: '12345' }]),
          update: jest.fn(),
        },
      },
    };
    const svc = new CourierBillsService(prisma as never);
    const r = await svc.import(
      'STEADFAST',
      'Consignment ID,Total Charge\n12345,135\n999,80\n',
      'bill-01.csv',
    );
    expect(r).toEqual({ rows: 2, matched: 1, updated: 1, unmatched: ['999'] });
    expect(prisma.client.shipment.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        billImportRef: 'bill-01.csv',
      }) as unknown,
    });
  });
});
