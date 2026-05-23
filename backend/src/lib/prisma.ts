import { PrismaClient, Prisma } from '@prisma/client';
import logger from './logger';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'info' },
      { emit: 'stdout', level: 'warn' },
    ],
  });

// Log slow queries (>500ms)
prisma.$on('query' as never, (e: Prisma.QueryEvent) => {
  if (e.duration >= 500) {
    logger.warn(`Slow Query (${e.duration}ms): ${e.query}`);
  }
});

// ---------------------------------------------------------------------------
// Soft-delete middleware: auto-filter deletedAt != null on find* queries
// and convert delete to soft-delete for Task, Resource, User.
// ---------------------------------------------------------------------------
const SOFT_DELETE_MODELS = ['Task', 'Resource', 'User'];

// Prisma 6 removed middleware support ($use). Use query extensions for soft-delete behavior.
const softDeleteExtension = Prisma.defineExtension((client) =>
  client.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async findUnique({ args, query }) {
          return query(args);
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async aggregate({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async groupBy({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            if (!args.where) args.where = {};
            if ((args.where as Record<string, unknown>).deletedAt === undefined) {
              (args.where as Record<string, unknown>).deletedAt = null;
            }
          }
          return query(args);
        },
        async delete({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            return (client as any)[model.toLowerCase()].update({
              where: args.where,
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.includes(model)) {
            return (client as any)[model.toLowerCase()].updateMany({
              where: args.where,
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
      },
    },
  })
);

export const db = prisma.$extends(softDeleteExtension);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Graceful shutdown — prevent connection pool leaks on container restart
async function gracefulShutdown() {
  await prisma.$disconnect();
}
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

export default prisma;
