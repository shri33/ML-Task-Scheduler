import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  });

// ---------------------------------------------------------------------------
// Soft-delete middleware: auto-filter deletedAt != null on find* queries
// and convert delete to soft-delete for Task, Resource, User.
// ---------------------------------------------------------------------------
const SOFT_DELETE_MODELS = ['Task', 'Resource', 'User'];

prisma.$use(async (params, next) => {
  const model = params.model as string | undefined;
  if (!model || !SOFT_DELETE_MODELS.includes(model)) return next(params);

  // Intercept find queries to exclude soft-deleted rows by default
  if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'findUnique') {
    if (!params.args) params.args = {};
    if (!params.args.where) params.args.where = {};
    // Only add the filter when the caller hasn't explicitly queried deletedAt
    if (params.args.where.deletedAt === undefined) {
      params.args.where.deletedAt = null;
    }
  }

  // Intercept count/aggregate to also exclude soft-deleted rows
  if (params.action === 'count' || params.action === 'aggregate' || params.action === 'groupBy') {
    if (!params.args) params.args = {};
    if (!params.args.where) params.args.where = {};
    if (params.args.where.deletedAt === undefined) {
      params.args.where.deletedAt = null;
    }
  }

  // Intercept delete → update with deletedAt
  if (params.action === 'delete') {
    params.action = 'update';
    if (!params.args) params.args = {};
    params.args.data = { deletedAt: new Date() };
  }

  // Intercept deleteMany → updateMany with deletedAt
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    if (!params.args) params.args = {};
    params.args.data = { deletedAt: new Date() };
  }

  return next(params);
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
