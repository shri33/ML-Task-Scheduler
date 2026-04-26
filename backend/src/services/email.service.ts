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

  // Anomaly detected notification
  async notifyAnomaly(task: any, actualTime: number, predictedTime: number): Promise<void> {
    try {
      const preferences = await prisma.notificationPreference.findMany({
        where: {
          emailAddress: { not: null }
          // For now, send to anyone with an email address if an anomaly occurs
          // In a real app, add a specific preference for this
        }
      });

      for (const pref of preferences) {
        if (!pref.emailAddress) continue;

        const html = this.generateAnomalyEmail(task, actualTime, predictedTime);
        await this.sendEmail({
          to: pref.emailAddress,
          subject: `⚠️ Performance Anomaly Detected: ${task.name}`,
          html
        });
      }
    } catch (error) {
      logger.error('Error sending anomaly notification', error instanceof Error ? error : new Error(String(error)));
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

  private generateAnomalyEmail(task: any, actualTime: number, predictedTime: number): string {
    const deviation = ((Math.abs(actualTime - predictedTime) / predictedTime) * 100).toFixed(1);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1e293b; }
          .container { max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; }
          .header { background: #f59e0b; color: white; padding: 32px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; }
          .alert-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; }
          .metric-card { background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 12px; }
          .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 32px; }
          .badge { padding: 4px 8px; rounded: 4px; font-size: 10px; font-weight: bold; background: #fef3c7; color: #92400e; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin:0;">⚠️ Anomaly Alert</h1>
            <p style="margin-top:8px; opacity:0.9;">System performance outlier detected</p>
          </div>
          <div class="content">
            <h2 style="margin-top:0;">Task: ${task.name}</h2>
            <div class="alert-box">
              <strong>Performance Deviation:</strong> <span class="badge">${deviation}%</span>
              <p style="margin: 8px 0 0 0; font-size: 14px;">The execution time for this task deviated significantly from the predicted baseline.</p>
            </div>
            
            <div class="metric-card">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Actual Execution</div>
              <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${actualTime.toFixed(2)}s</div>
            </div>
            
            <div class="metric-card">
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Predicted Runtime</div>
              <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${predictedTime.toFixed(2)}s</div>
            </div>

            <p style="font-size: 14px; color: #475569;">
              <strong>Node:</strong> ${task.resource?.name || 'N/A'}<br/>
              <strong>Type:</strong> ${task.type}<br/>
              <strong>Timestamp:</strong> ${new Date().toLocaleString()}
            </p>
          </div>
          <div class="footer">
            <p>Nova AI Task Scheduler • Intelligent System Monitoring</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
export default emailService;
