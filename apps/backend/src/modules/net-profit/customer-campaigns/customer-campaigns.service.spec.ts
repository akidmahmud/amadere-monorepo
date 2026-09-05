import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import { SmtpEmailProvider } from '../cart-campaigns/providers/smtp-email.provider';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import { CustomerCampaignsService, CustomerCampaignSettings } from './customer-campaigns.service';

const ON: CustomerCampaignSettings = {
  enabled: true,
  maxAttempts: 3,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  recurringBatchSize: 200,
};

describe('CustomerCampaignsService', () => {
  let service: CustomerCampaignsService;
  let settings: CustomerCampaignSettings;
  let queueRows: { id: number; template: { status: string } }[];
  let updates: { where: { id: number }; data: Record<string, unknown> }[];
  let smsSent: number;
  let emailSent: number;

  beforeEach(async () => {
    settings = { ...ON };
    queueRows = [];
    updates = [];
    smsSent = 0;
    emailSent = 0;

    const prisma = {
      client: {
        customerCampaignQueue: {
          findMany: jest.fn(() => Promise.resolve(queueRows)),
          update: jest.fn((args: { where: { id: number }; data: Record<string, unknown> }) => {
            updates.push(args);
            return Promise.resolve({});
          }),
          findUniqueOrThrow: jest.fn(() =>
            Promise.resolve({
              id: 1,
              recipient: 'a@b.com',
              channel: 'EMAIL',
              templateId: 1,
              template: {
                subject: 'Hi',
                bodyEn: 'Hello {{first_name}}',
                bodyBn: 'x',
                bodyHtmlEn: '<p>Hello {{first_name}}</p>',
                bodyHtmlBn: null,
                status: 'ACTIVE',
              },
              customer: { firstName: 'Rahim', lastName: 'Uddin' },
            }),
          ),
          createMany: jest.fn(() => Promise.resolve({ count: 0 })),
        },
        customer: { findUnique: jest.fn(() => Promise.resolve(null)) },
        customerCampaignTemplate: { findMany: jest.fn(() => Promise.resolve([])) },
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomerCampaignsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NetProfitSettingsService, useValue: { get: jest.fn(() => Promise.resolve(settings)), set: jest.fn() } },
        {
          provide: SmsService,
          useValue: { send: jest.fn(() => { smsSent += 1; return Promise.resolve({ id: 1, status: 'SENT' }); }) },
        },
        {
          provide: SmtpEmailProvider,
          useValue: { send: jest.fn(() => { emailSent += 1; return Promise.resolve({ id: 'x' }); }) },
        },
      ],
    }).compile();

    service = moduleRef.get(CustomerCampaignsService);
  });

  afterEach(() => jest.useRealTimers());

  /** Freeze the clock at a given local hour. */
  function atHour(hour: number) {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 5, hour, 0, 0));
  }

  it('sends nothing at all while the engine is disabled', async () => {
    settings.enabled = false;
    queueRows = [{ id: 1, template: { status: 'ACTIVE' } }];
    atHour(12);

    await service.processQueue();

    expect(updates).toHaveLength(0);
    expect(emailSent + smsSent).toBe(0);
  });

  // 22:00–08:00 wraps midnight, which is exactly where a naive
  // `hour >= start && hour < end` check silently sends at 3am.
  it('respects quiet hours across midnight', async () => {
    queueRows = [{ id: 1, template: { status: 'ACTIVE' } }];

    for (const hour of [22, 23, 0, 3, 7]) {
      atHour(hour);
      await service.processQueue();
      expect(emailSent + smsSent).toBe(0);
    }

    atHour(9);
    await service.processQueue();
    expect(emailSent).toBe(1);
  });

  it('skips a step whose template was paused after it was queued', async () => {
    queueRows = [{ id: 7, template: { status: 'PAUSED' } }];
    atHour(12);

    await service.processQueue();

    expect(emailSent + smsSent).toBe(0);
    expect(updates).toEqual([{ where: { id: 7 }, data: { status: 'SKIPPED' } }]);
  });

  // Merge tags have to reach the HTML body too, and the plain body must still
  // be sent alongside it as the text/plain alternative.
  it('substitutes the customer name into both the text and HTML bodies', async () => {
    atHour(12);
    const email = service['email'] as unknown as { send: jest.Mock };

    await service.sendQueueItem(1);

    expect(email.send).toHaveBeenCalledWith('a@b.com', 'Hi', 'Hello Rahim', {
      html: '<p>Hello Rahim</p>',
    });
  });

  it('queues nothing when the engine is off, whatever templates exist', async () => {
    settings.enabled = false;
    await service.enqueueForCustomer(123);
    const prisma = service['prisma'] as unknown as {
      client: { customerCampaignQueue: { createMany: jest.Mock } };
    };
    expect(prisma.client.customerCampaignQueue.createMany).not.toHaveBeenCalled();
  });
});
