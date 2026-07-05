import { prisma } from '../db/prisma.js';
import { NotFoundError } from '../errors/index.js';
import { CallSession, USSDSession } from '@prisma/client';

export interface PaginatedCallSessions {
  data: Omit<CallSession, 'transcript'>[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

export class SessionsService {
  async getCallSessions(filters: {
    limit: number;
    cursor?: string;
    phone?: string;
    since?: string;
  }): Promise<PaginatedCallSessions> {
    const where: any = {};

    if (filters.phone) {
      where.customerPhone = filters.phone;
    }
    if (filters.since) {
      where.createdAt = { gt: new Date(filters.since) };
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
    const items = await prisma.callSession.findMany({
      where,
      take: limit + 1,
      skip: prismaCursor ? 1 : 0,
      cursor: prismaCursor,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        customerPhone: true,
        status: true,
        orderId: true,
        createdAt: true,
        endedAt: true,
      },
    });

    const hasMore = items.length > limit;
    const data = (hasMore ? items.slice(0, limit) : items) as unknown as Omit<CallSession, 'transcript'>[];
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

  async getCallSession(id: string): Promise<CallSession> {
    const session = await prisma.callSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundError(`Call Session not found: ${id}`);
    }

    return session;
  }

  async getUssdSession(id: string): Promise<USSDSession> {
    const session = await prisma.uSSDSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundError(`USSD Session not found: ${id}`);
    }

    return session;
  }
}

export const sessionsService = new SessionsService();
export default sessionsService;
