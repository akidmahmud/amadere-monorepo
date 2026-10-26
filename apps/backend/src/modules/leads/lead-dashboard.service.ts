import { Injectable } from '@nestjs/common';
import { LeadCallOutcome } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { dhakaDate, dhakaDayEnd, dhakaDayStart } from '../product-cost-history/dhaka-date';
import type { LeadDashboardQueryDto } from './dto/lead.dto';

const ANSWERED: LeadCallOutcome[] = [
  'ANSWERED_INTERESTED',
  'ANSWERED_CALL_BACK',
  'ANSWERED_REGULAR_BUYER',
  'ANSWERED_WHOLESALE',
  'ORDER_PLACED',
];
const DAY_MS = 86_400_000;
const MONTH_MS = 30.44 * DAY_MS;

/** "label → count", biggest first — the shape every bar list on the page uses. */
function tally<T>(rows: T[], key: (r: T) => string | null | undefined): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r) || 'Not set';
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/** Every Dhaka day from `from` to `to`, inclusive (at most 120). */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`) && out.length < 120; t += DAY_MS)
    out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** Customers by how long since their last order (the demo's segments). */
export function segmentOf(lastOrderAt: Date, now: Date): 'Active (0-2 mo)' | 'At Risk (2-6 mo)' | 'Dormant (6+ mo)' {
  const months = (now.getTime() - lastOrderAt.getTime()) / MONTH_MS;
  return months < 2 ? 'Active (0-2 mo)' : months < 6 ? 'At Risk (2-6 mo)' : 'Dormant (6+ mo)';
}

/**
 * Lead Center dashboard: the call desk's numbers for a period (default the
 * last 30 days), optionally for one agent. Leads, lead calls and customer
 * calls all count, so it reflects the whole calling team's work.
 */
@Injectable()
export class LeadDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(q: LeadDashboardQueryDto) {
    const now = new Date();
    const to = q.to ?? dhakaDate(now);
    const from = q.from ?? dhakaDate(new Date(Date.parse(`${to}T00:00:00Z`) - 29 * DAY_MS));
    const range = { gte: dhakaDayStart(from), lte: dhakaDayEnd(to) };
    const today = new Date(`${dhakaDate(now)}T00:00:00.000Z`);
    const agent = q.agentId;
    const db = this.prisma.client;

    const [newLeads, converted, leadCalls, customerCalls, openLeads, dueCustomers, lost, periodOrders, lastOrders, staff] =
      await Promise.all([
        db.lead.count({ where: { createdAt: range, deletedAt: null, ...(agent ? { assignedAdminId: agent } : {}) } }),
        db.lead.findMany({
          where: { convertedAt: range, deletedAt: null, ...(agent ? { assignedAdminId: agent } : {}) },
          select: { id: true, leadSource: true, assignedAdminId: true, convertedOrderId: true },
        }),
        db.leadCallLog.findMany({
          where: { createdAt: range, ...(agent ? { authorAdminId: agent } : {}) },
          select: { leadId: true, outcome: true, authorAdminId: true, createdAt: true },
        }),
        db.customerCallLog.findMany({
          where: {
            createdAt: range,
            // Copies of lead calls made when a lead converts — already counted.
            NOT: { notes: { startsWith: 'Lead call:' } },
            ...(agent ? { authorAdminId: agent } : {}),
          },
          select: { outcome: true, authorAdminId: true, createdAt: true },
        }),
        db.lead.findMany({
          where: { convertedAt: null, deletedAt: null, ...(agent ? { assignedAdminId: agent } : {}) },
          select: { assignedAdminId: true, status: true, nextCallDate: true },
        }),
        db.customer.findMany({
          where: { deletedAt: null, nextCallTarget: { lte: today }, ...(agent ? { assignedAdminId: agent } : {}) },
          select: { assignedAdminId: true },
        }),
        db.lead.findMany({
          where: { status: 'LOST', updatedAt: range, deletedAt: null, ...(agent ? { assignedAdminId: agent } : {}) },
          select: { lostReason: true },
        }),
        db.order.findMany({
          where: {
            createdAt: range,
            deletedAt: null,
            channel: { not: 'POS' },
            status: { not: 'CANCELED' },
            customerId: { not: null },
            ...(agent ? { assignedAdminId: agent } : {}),
          },
          select: { id: true, customerId: true, createdAt: true, totalAmount: true, assignedAdminId: true },
        }),
        db.order.groupBy({
          by: ['customerId'],
          where: { deletedAt: null, channel: { not: 'POS' }, status: { not: 'CANCELED' }, customerId: { not: null } },
          _min: { createdAt: true },
          _max: { createdAt: true },
        }),
        db.adminUser.findMany({ where: { deletedAt: null }, select: { id: true, firstName: true, lastName: true } }),
      ]);

    // A repeat order: the customer had ordered before this one.
    const firstOrderAt = new Map(lastOrders.map((r) => [r.customerId as number, r._min.createdAt]));
    const repeat = periodOrders.filter((o) => {
      const first = firstOrderAt.get(o.customerId as number);
      return first && first < o.createdAt;
    });
    const firstOrderIds = new Set(converted.map((c) => c.convertedOrderId).filter((x): x is number => !!x));
    // A converted lead's order may be older than the period (the lead was
    // worked for a while), so its value is read by id, not from periodOrders.
    const firstOrders = await db.order.findMany({
      where: { id: { in: [...firstOrderIds] } },
      select: { id: true, totalAmount: true },
    });
    const valueByOrder = new Map(firstOrders.map((o) => [o.id, Number(o.totalAmount)]));
    const firstOrderValue = firstOrders.reduce((s, o) => s + Number(o.totalAmount), 0);
    const repeatValue = repeat.reduce((s, o) => s + Number(o.totalAmount), 0);

    const answered = (c: { outcome: string }) =>
      ANSWERED.includes(c.outcome as LeadCallOutcome) || c.outcome === 'CONNECTED';
    const allCalls = [...leadCalls, ...customerCalls];
    const answeredN = allCalls.filter(answered).length;
    const calledLeads = new Set(leadCalls.map((c) => c.leadId));
    const convertedCalled = converted.filter((c) => calledLeads.has(c.id)).length;
    const leadsDue = openLeads.filter((l) => l.nextCallDate && l.nextCallDate <= today);

    const perDay = new Map(daysBetween(from, to).map((d) => [d, { answered: 0, notReached: 0 }]));
    for (const c of allCalls) {
      const d = perDay.get(dhakaDate(c.createdAt));
      if (d) answered(c) ? d.answered++ : d.notReached++;
    }

    const segments = tally(
      lastOrders.filter((r) => r._max.createdAt),
      (r) => segmentOf(r._max.createdAt as Date, now),
    );

    const name = new Map(staff.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
    const agents = new Set<number>([
      ...openLeads.map((l) => l.assignedAdminId),
      ...allCalls.map((c) => c.authorAdminId),
      ...converted.map((c) => c.assignedAdminId),
      ...repeat.map((o) => o.assignedAdminId),
    ].filter((x): x is number => x !== null));
    const agentPerformance = [...agents]
      .map((id) => {
        const firsts = converted.filter((c) => c.assignedAdminId === id);
        const repeats = repeat.filter((o) => o.assignedAdminId === id);
        const calls = allCalls.filter((c) => c.authorAdminId === id);
        return {
          agentId: id,
          agent: name.get(id) ?? `#${id}`,
          // Still being worked: Lost and Do-not-call don't count.
          openLeads: openLeads.filter((l) => l.assignedAdminId === id && l.status !== 'LOST' && l.status !== 'DNC').length,
          callsMade: calls.length,
          answered: calls.filter(answered).length,
          firstOrders: firsts.length,
          repeatOrders: repeats.length,
          orderValue:
            firsts.reduce((s, c) => s + (c.convertedOrderId ? (valueByOrder.get(c.convertedOrderId) ?? 0) : 0), 0) +
            repeats.reduce((s, o) => s + Number(o.totalAmount), 0),
          dueNow:
            leadsDue.filter((l) => l.assignedAdminId === id).length +
            dueCustomers.filter((c) => c.assignedAdminId === id).length,
        };
      })
      .sort((a, b) => b.callsMade - a.callsMade || b.firstOrders - a.firstOrders);

    return {
      from,
      to,
      kpis: {
        newLeads,
        firstOrders: converted.length,
        firstOrdersOfCalledPct: calledLeads.size ? Math.round((convertedCalled / calledLeads.size) * 100) : 0,
        repeatOrders: repeat.length,
        orderValue: firstOrderValue + repeatValue,
        calls: allCalls.length,
        answeredPct: allCalls.length ? Math.round((answeredN / allCalls.length) * 100) : 0,
        followUpsDue: leadsDue.length + dueCustomers.length,
        doNotCall: openLeads.filter((l) => l.status === 'DNC').length,
      },
      callsPerDay: [...perDay].map(([day, v]) => ({ day, ...v })),
      callOutcomes: tally(leadCalls, (c) => c.outcome),
      firstOrdersBySource: tally(converted, (c) => c.leadSource),
      lostReasons: tally(lost, (l) => l.lostReason),
      customersByLastOrder: segments,
      agentPerformance,
    };
  }
}
