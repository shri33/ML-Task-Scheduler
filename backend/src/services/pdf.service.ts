// @ts-ignore
import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';

interface ReportData {
  title: string;
  generatedAt: Date;
  tasks: any[];
  resources: any[];
  metrics: any;
}

class PDFService {
  async generateTaskSummaryReport(): Promise<Buffer> {
    const [tasks, resources, taskStats] = await Promise.all([
      prisma.task.findMany({
        include: { resource: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.resource.findMany(),
      this.getTaskStats()
    ]);

    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Task Scheduling Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary Section
    doc.fontSize(16).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Tasks: ${taskStats.total}`);
    doc.text(`Pending: ${taskStats.pending} | Scheduled: ${taskStats.scheduled} | Running: ${taskStats.running}`);
    doc.text(`Completed: ${taskStats.completed} | Failed: ${taskStats.failed}`);
    doc.text(`Total Resources: ${resources.length}`);
    doc.text(`Average Resource Load: ${this.calculateAvgLoad(resources).toFixed(1)}%`);
    doc.moveDown(2);

    // Tasks Table
    doc.fontSize(16).font('Helvetica-Bold').text('Recent Tasks');
    doc.moveDown(0.5);

    // Table header
    const tableTop = doc.y;
    const colWidths = [150, 60, 60, 60, 80, 80];
    const headers = ['Name', 'Type', 'Size', 'Priority', 'Status', 'Predicted'];

    doc.fontSize(9).font('Helvetica-Bold');
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let y = tableTop + 20;

    tasks.slice(0, 20).forEach((task) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const row = [
        task.name.substring(0, 25),
        task.type,
        task.size,
        task.priority.toString(),
        task.status,
        task.predictedTime ? `${task.predictedTime}s` : '-'
      ];

      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });

      y += 15;
    });

    doc.moveDown(2);

    // Resources Section
    if (doc.y > 600) doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').text('Resources');
    doc.moveDown(0.5);

    resources.forEach((resource) => {
      doc.fontSize(10).font('Helvetica');
      doc.text(`${resource.name}: ${resource.currentLoad}% load (${resource.status})`);
    });

    // Footer
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(
        `Page ${i + 1} of ${pageCount} | ML Task Scheduler Report`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );
    }

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }

  async generatePerformanceReport(): Promise<Buffer> {
    const [scheduleHistory, predictions] = await Promise.all([
      prisma.scheduleHistory.findMany({
        include: { task: true, resource: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.prediction.findMany({
        include: { task: true },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    ]);

    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('ML Performance Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // ML Metrics
    const mlMetrics = this.calculateMLMetrics(scheduleHistory);
    
    doc.fontSize(16).font('Helvetica-Bold').text('ML Prediction Performance');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Predictions: ${predictions.length}`);
    doc.text(`Average Confidence: ${(mlMetrics.avgConfidence * 100).toFixed(1)}%`);
    doc.text(`Predictions with ML: ${mlMetrics.withML}`);
    doc.text(`Predictions without ML: ${mlMetrics.withoutML}`);
    
    if (mlMetrics.avgError !== null) {
      doc.text(`Average Prediction Error: ${mlMetrics.avgError.toFixed(2)}s`);
    }
    doc.moveDown(2);

    // Schedule History
    doc.fontSize(16).font('Helvetica-Bold').text('Recent Scheduling Decisions');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica');
    scheduleHistory.slice(0, 15).forEach((history) => {
      doc.text(`• ${history.task.name} → ${history.resource.name} (Score: ${history.score?.toFixed(3) || 'N/A'})`);
    });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }

  async generateResourceUtilizationReport(): Promise<Buffer> {
    const resources = await prisma.resource.findMany({
      include: {
        tasks: {
          where: { status: { in: ['SCHEDULED', 'RUNNING'] } }
        },
        _count: { select: { tasks: true, scheduleHistory: true } }
      }
    });

    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Resource Utilization Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Resource Details
    resources.forEach((resource) => {
      doc.fontSize(14).font('Helvetica-Bold').text(resource.name);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Status: ${resource.status}`);
      doc.text(`Capacity: ${resource.capacity}`);
      doc.text(`Current Load: ${resource.currentLoad}%`);
      doc.text(`Active Tasks: ${resource.tasks.length}`);
      doc.text(`Total Tasks Processed: ${resource._count.scheduleHistory}`);

      // Load bar visualization
      const barWidth = 200;
      const barHeight = 15;
      const loadWidth = (resource.currentLoad / 100) * barWidth;
      
      doc.rect(50, doc.y + 5, barWidth, barHeight).stroke();
      doc.rect(50, doc.y + 5, loadWidth, barHeight)
        .fill(resource.currentLoad > 80 ? '#ef4444' : resource.currentLoad > 50 ? '#f59e0b' : '#22c55e');
      
      doc.moveDown(2);
    });

    doc.end();

    return new Promise((resolve) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
    });
  }

  private async getTaskStats() {
    const stats = await prisma.task.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    const result = {
      total: 0,
      pending: 0,
      scheduled: 0,
      running: 0,
      completed: 0,
      failed: 0
    };

    stats.forEach((s) => {
      const count = s._count.status;
      result.total += count;
      switch (s.status) {
        case 'PENDING': result.pending = count; break;
        case 'SCHEDULED': result.scheduled = count; break;
        case 'RUNNING': result.running = count; break;
        case 'COMPLETED': result.completed = count; break;
        case 'FAILED': result.failed = count; break;
      }
    });

    return result;
  }

  private calculateAvgLoad(resources: any[]): number {
    if (resources.length === 0) return 0;
    const totalLoad = resources.reduce((sum, r) => sum + r.currentLoad, 0);
    return totalLoad / resources.length;
  }

  private calculateMLMetrics(history: any[]) {
    const withML = history.filter(h => h.mlEnabled);
    const withoutML = history.filter(h => !h.mlEnabled);

    let avgError = null;
    const completedWithPrediction = history.filter(h => h.predictedTime && h.actualTime);
    if (completedWithPrediction.length > 0) {
      const totalError = completedWithPrediction.reduce(
        (sum, h) => sum + Math.abs(h.predictedTime - h.actualTime),
        0
      );
      avgError = totalError / completedWithPrediction.length;
    }

    const avgConfidence = withML.length > 0
      ? withML.filter(h => h.score).reduce((sum, h) => sum + (h.score || 0), 0) / withML.length
      : 0;

    return {
      withML: withML.length,
      withoutML: withoutML.length,
      avgError,
      avgConfidence
    };
  }
}

export const pdfService = new PDFService();
export default pdfService;
