import { CustomersService } from './customers.service';

// A call logged from the customer popup fills the list's columns: what they
// said becomes Customer feedback, the date becomes Next call target.
describe('CustomersService.logCall', () => {
  const make = () => {
    const prisma = {
      client: {
        customer: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 9, phone: '8801711111111' }), update: jest.fn() },
        customerCallLog: { create: jest.fn(({ data }) => ({ id: 1, createdAt: new Date(), ...data })) },
      },
    };
    return { prisma, service: new CustomersService(prisma as never, {} as never, {} as never) };
  };

  it('the note becomes Customer feedback and the date the Next call target', async () => {
    const { prisma, service } = make();
    await service.logCall(9, { outcome: 'CONNECTED', notes: ' wants ghee next week ', nextCallTarget: '2026-11-05' } as never, 3);
    expect(prisma.client.customer.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { customerFeedback: 'wants ghee next week', nextCallTarget: new Date('2026-11-05T00:00:00.000Z') },
    });
  });

  it('no note and no date: the customer is left alone', async () => {
    const { prisma, service } = make();
    await service.logCall(9, { outcome: 'NO_ANSWER' } as never, 3);
    expect(prisma.client.customer.update).not.toHaveBeenCalled();
  });
});
