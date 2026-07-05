import { prisma } from '../db/prisma.js';
import { NotFoundError, InvalidStateTransitionError } from '../errors/index.js';
import { Order, OrderItem, Payment, VendorFulfillment } from '@prisma/client';

export interface PaginatedOrders {
  data: Order[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export class OrdersService {
  async getOrders(filters: {
    limit: number;
    cursor?: string;
    status?: string;
    channel?: 'voice' | 'ussd';
    since?: string;
  }): Promise<PaginatedOrders> {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.channel) {
      where.channel = filters.channel;
    }
    if (filters.since) {
      where.updatedAt = { gt: new Date(filters.since) };
    }

    let prismaCursor = undefined;
    if (filters.cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(filters.cursor, 'base64').toString('ascii'));
        if (decoded && decoded.id) {
          prismaCursor = { id: decoded.id };
        }
      } catch (err) {
        // Fallback for invalid cursors
      }
    }

    const limit = filters.limit;
    const items = await prisma.order.findMany({
      where,
      take: limit + 1,
      skip: prismaCursor ? 1 : 0,
      cursor: prismaCursor,
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const lastItem = data[data.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ id: lastItem.id })).toString('base64');
    }

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async getOrder(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
        fulfillments: {
          include: {
            disbursements: true,
          },
        },
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    return order;
  }

  async cancelOrder(orderId: string, idempotencyKey: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    // Contract §5.4: invalid-state-transition — cannot cancel an already-disbursed order.
    // Also guard against double-cancel returning a silent 200 with no state change.
    if (order.status === 'disbursed') {
      throw new InvalidStateTransitionError('Cannot cancel an already-disbursed order');
    }

    if (order.status === 'cancelled') {
      throw new InvalidStateTransitionError('Order is already cancelled');
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'cancelled' },
      include: {
        orderItems: true,
        fulfillments: {
          include: {
            disbursements: true,
          },
        },
        payment: true,
      },
    });

    return updated;
  }
}

export const ordersService = new OrdersService();
export default ordersService;
