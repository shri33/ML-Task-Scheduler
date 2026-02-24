import { Router, Request, Response, NextFunction } from 'express';
import pdfService from '../services/pdf.service';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All report routes require authentication
router.use(authenticate);

// CSV sanitization helper to prevent formula injection
function sanitizeCsvValue(value: unknown): string {
  const str = String(value ?? '');
  // Prevent formula injection: prefix dangerous characters with a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  // Wrap in quotes if contains comma, newline, or double quote
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvRow(values: unknown[]): string {
  return values.map(sanitizeCsvValue).join(',');
}

// ============ PDF REPORTS ============

/**
 * @swagger
 * /api/reports/pdf/tasks:
 *   get:
 *     summary: Download task summary PDF report
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/pdf/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pdfBuffer = await pdfService.generateTaskSummaryReport();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=task-summary-report.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/reports/pdf/performance:
 *   get:
 *     summary: Download ML performance PDF report
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: PDF file download
 */
router.get('/pdf/performance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pdfBuffer = await pdfService.generatePerformanceReport();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=ml-performance-report.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/reports/pdf/resources:
 *   get:
 *     summary: Download resource utilization PDF report
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: PDF file download
 */
router.get('/pdf/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pdfBuffer = await pdfService.generateResourceUtilizationReport();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=resource-utilization-report.pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// ============ CSV EXPORTS ============

/**
 * @swagger
 * /api/reports/csv/tasks:
 *   get:
 *     summary: Download tasks as CSV
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: CSV file download
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/csv/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await prisma.task.findMany({
      include: { resource: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10000 // Prevent unbounded export
    });

    const headers = ['ID', 'Name', 'Type', 'Size', 'Priority', 'Status', 'Due Date', 'Predicted Time', 'Actual Time', 'Resource', 'Created At', 'Completed At'];
    const csvRows = [headers.join(',')];

    tasks.forEach((task) => {
      csvRows.push(buildCsvRow([
        task.id,
        task.name,
        task.type,
        task.size,
        task.priority,
        task.status,
        task.dueDate ? new Date(task.dueDate).toISOString() : '',
        task.predictedTime || '',
        task.actualTime || '',
        task.resource?.name || '',
        new Date(task.createdAt).toISOString(),
        task.completedAt ? new Date(task.completedAt).toISOString() : ''
      ]));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks-export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/reports/csv/resources:
 *   get:
 *     summary: Download resources as CSV
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/csv/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resources = await prisma.resource.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { name: 'asc' },
      take: 10000 // Prevent unbounded export
    });

    const headers = ['ID', 'Name', 'Capacity', 'Current Load (%)', 'Status', 'Active Tasks', 'Created At'];
    const csvRows = [headers.join(',')];

    resources.forEach(resource => {
      csvRows.push(buildCsvRow([
        resource.id,
        resource.name,
        resource.capacity,
        resource.currentLoad.toFixed(1),
        resource.status,
        resource._count.tasks,
        new Date(resource.createdAt).toISOString()
      ]));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=resources-export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/reports/csv/schedule-history:
 *   get:
 *     summary: Download scheduling history as CSV
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/csv/schedule-history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.scheduleHistory.findMany({
      include: { 
        task: { select: { name: true } }, 
        resource: { select: { name: true } } 
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    const headers = ['ID', 'Task', 'Resource', 'Algorithm', 'ML Enabled', 'Predicted Time', 'Actual Time', 'Score', 'Created At'];
    const csvRows = [headers.join(',')];

    history.forEach(h => {
      csvRows.push(buildCsvRow([
        h.id,
        h.task.name,
        h.resource.name,
        h.algorithm,
        h.mlEnabled ? 'Yes' : 'No',
        h.predictedTime || '',
        h.actualTime || '',
        h.score?.toFixed(3) || '',
        new Date(h.createdAt).toISOString()
      ]));
    });

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=schedule-history-export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ============ REPORT LIST ============

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: List all available reports
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: List of available reports
 */
router.get('/', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      pdfReports: [
        {
          name: 'Task Summary',
          endpoint: '/api/reports/pdf/tasks',
          description: 'Summary of all tasks with status breakdown'
        },
        {
          name: 'ML Performance',
          endpoint: '/api/reports/pdf/performance',
          description: 'ML prediction accuracy and scheduling metrics'
        },
        {
          name: 'Resource Utilization',
          endpoint: '/api/reports/pdf/resources',
          description: 'Resource load and utilization analysis'
        }
      ],
      csvExports: [
        {
          name: 'Tasks CSV',
          endpoint: '/api/reports/csv/tasks',
          description: 'Export all tasks as CSV spreadsheet'
        },
        {
          name: 'Resources CSV',
          endpoint: '/api/reports/csv/resources',
          description: 'Export all resources as CSV spreadsheet'
        },
        {
          name: 'Schedule History CSV',
          endpoint: '/api/reports/csv/schedule-history',
          description: 'Export scheduling history as CSV'
        }
      ]
    }
  });
});

export default router;
