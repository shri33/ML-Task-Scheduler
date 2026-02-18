import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587');
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });
      this.isConfigured = true;
      logger.info('Email service configured');
    } else {
      logger.info('Email service not configured (missing SMTP credentials)');
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.transporter !== null;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isAvailable()) {
      logger.debug('Email not sent (service not configured)', { subject: options.subject });
      return false;
    }

    try {
      const fromAddress = process.env.EMAIL_FROM || 'noreply@task-scheduler.com';
      
      await this.transporter!.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      });

      logger.info('Email sent', { subject: options.subject, to: options.to });
      return true;
    } catch (error) {
      logger.error('Email send error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  // Task completed notification
  async notifyTaskCompleted(taskId: string): Promise<void> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { resource: true }
      });

      if (!task) return;

      // Get users who want task completion notifications
      const preferences = await prisma.notificationPreference.findMany({
        where: {
          emailOnTaskComplete: true,
          emailAddress: { not: null }
        },
        include: { user: true }
      });

      for (const pref of preferences) {
        if (!pref.emailAddress) continue;

        const html = this.generateTaskCompletedEmail(task);
        await this.sendEmail({
          to: pref.emailAddress,
          subject: `✅ Task Completed: ${task.name}`,
          html
        });
      }
    } catch (error) {
      logger.error('Error sending task completed notification', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Task failed notification
  async notifyTaskFailed(taskId: string, error?: string): Promise<void> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { resource: true }
      });

      if (!task) return;

      const preferences = await prisma.notificationPreference.findMany({
        where: {
          emailOnTaskFailed: true,
          emailAddress: { not: null }
        },
        include: { user: true }
      });

      for (const pref of preferences) {
        if (!pref.emailAddress) continue;

        const html = this.generateTaskFailedEmail(task, error);
        await this.sendEmail({
          to: pref.emailAddress,
          subject: `❌ Task Failed: ${task.name}`,
          html
        });
      }
    } catch (error) {
      logger.error('Error sending task failed notification', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Daily summary notification
  async sendDailySummary(): Promise<void> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const [completedTasks, failedTasks, totalScheduled] = await Promise.all([
        prisma.task.count({
          where: {
            status: 'COMPLETED',
            completedAt: { gte: yesterday }
          }
        }),
        prisma.task.count({
          where: {
            status: 'FAILED',
            completedAt: { gte: yesterday }
          }
        }),
        prisma.scheduleHistory.count({
          where: {
            createdAt: { gte: yesterday }
          }
        })
      ]);

      const preferences = await prisma.notificationPreference.findMany({
        where: {
          emailDailySummary: true,
          emailAddress: { not: null }
        }
      });

      for (const pref of preferences) {
        if (!pref.emailAddress) continue;

        const html = this.generateDailySummaryEmail({
          completed: completedTasks,
          failed: failedTasks,
          scheduled: totalScheduled,
          date: yesterday
        });

        await this.sendEmail({
          to: pref.emailAddress,
          subject: `📊 Daily Task Summary - ${yesterday.toLocaleDateString()}`,
          html
        });
      }
    } catch (error) {
      logger.error('Error sending daily summary', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Email templates
  private generateTaskCompletedEmail(task: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .metric { display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 4px; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Task Completed</h1>
          </div>
          <div class="content">
            <h2>${task.name}</h2>
            <p>Your task has been completed successfully.</p>
            <div class="metric"><strong>Type:</strong> ${task.type}</div>
            <div class="metric"><strong>Size:</strong> ${task.size}</div>
            <div class="metric"><strong>Priority:</strong> ${task.priority}/5</div>
            ${task.resource ? `<div class="metric"><strong>Resource:</strong> ${task.resource.name}</div>` : ''}
            ${task.actualTime ? `<div class="metric"><strong>Execution Time:</strong> ${task.actualTime}s</div>` : ''}
            ${task.predictedTime ? `<div class="metric"><strong>Predicted Time:</strong> ${task.predictedTime}s</div>` : ''}
          </div>
          <div class="footer">
            <p>ML Task Scheduler - Intelligent Task Allocation System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateTaskFailedEmail(task: any, error?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .error-box { background: #fee2e2; border: 1px solid #ef4444; padding: 10px; border-radius: 4px; margin: 10px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Task Failed</h1>
          </div>
          <div class="content">
            <h2>${task.name}</h2>
            <p>Unfortunately, your task has failed.</p>
            ${error ? `<div class="error-box"><strong>Error:</strong> ${error}</div>` : ''}
            <p><strong>Type:</strong> ${task.type} | <strong>Size:</strong> ${task.size}</p>
            ${task.resource ? `<p><strong>Resource:</strong> ${task.resource.name}</p>` : ''}
          </div>
          <div class="footer">
            <p>ML Task Scheduler - Intelligent Task Allocation System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDailySummaryEmail(stats: any): string {
    const successRate = stats.completed + stats.failed > 0
      ? ((stats.completed / (stats.completed + stats.failed)) * 100).toFixed(1)
      : '100';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { background: white; padding: 15px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-label { color: #666; font-size: 14px; }
          .success { color: #10b981; }
          .danger { color: #ef4444; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily Summary</h1>
            <p>${stats.date.toLocaleDateString()}</p>
          </div>
          <div class="content">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${stats.scheduled}</div>
                <div class="stat-label">Tasks Scheduled</div>
              </div>
              <div class="stat-card">
                <div class="stat-value success">${stats.completed}</div>
                <div class="stat-label">Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-value danger">${stats.failed}</div>
                <div class="stat-label">Failed</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">${successRate}%</div>
                <div class="stat-label">Success Rate</div>
              </div>
            </div>
          </div>
          <div class="footer">
            <p>ML Task Scheduler - Intelligent Task Allocation System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
export default emailService;
