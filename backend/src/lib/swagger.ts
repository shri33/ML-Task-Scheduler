import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ML Task Scheduler API',
      version: '1.0.0',
      description: `
# ML Task Scheduler API Documentation

An intelligent task scheduling system with ML-powered execution time predictions.

## Features
- **Task Management**: Create, update, delete, and schedule tasks
- **Resource Management**: Manage fog computing nodes/servers
- **ML Predictions**: Get AI-powered execution time predictions
- **Analytics**: View performance metrics and comparisons
- **Reports**: Download PDF and CSV reports

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

## Rate Limiting
- General API: 100 requests per 15 minutes
- Scheduling API: 20 requests per minute
      `,
      contact: {
        name: 'Team Byte_hogs',
        email: 'support@ml-task-scheduler.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    tags: [
      { name: 'Tasks', description: 'Task management operations' },
      { name: 'Resources', description: 'Resource/fog node management' },
      { name: 'Schedule', description: 'Task scheduling with ML' },
      { name: 'Metrics', description: 'System metrics and analytics' },
      { name: 'Reports', description: 'PDF and CSV report generation' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Fog', description: 'Fog computing algorithms' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Data Processing Job' },
            type: { type: 'string', enum: ['CPU', 'IO', 'MIXED'] },
            size: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE'] },
            priority: { type: 'integer', minimum: 1, maximum: 5 },
            status: { type: 'string', enum: ['PENDING', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED'] },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            predictedTime: { type: 'number', nullable: true },
            actualTime: { type: 'number', nullable: true },
            resourceId: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            scheduledAt: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        CreateTask: {
          type: 'object',
          required: ['name', 'type', 'size', 'priority'],
          properties: {
            name: { type: 'string', example: 'Data Processing Job' },
            type: { type: 'string', enum: ['CPU', 'IO', 'MIXED'] },
            size: { type: 'string', enum: ['SMALL', 'MEDIUM', 'LARGE'] },
            priority: { type: 'integer', minimum: 1, maximum: 5 },
            dueDate: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        Resource: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Fog-Node-1' },
            capacity: { type: 'integer', example: 100 },
            currentLoad: { type: 'number', example: 45.5 },
            status: { type: 'string', enum: ['AVAILABLE', 'BUSY', 'OFFLINE'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        CreateResource: {
          type: 'object',
          required: ['name', 'capacity'],
          properties: {
            name: { type: 'string', example: 'Fog-Node-1' },
            capacity: { type: 'integer', example: 100 }
          }
        },
        ScheduleRequest: {
          type: 'object',
          properties: {
            taskIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              description: 'Optional array of task IDs to schedule. If empty, schedules all pending tasks.'
            },
            algorithm: {
              type: 'string',
              enum: ['ML', 'HEURISTIC', 'HYBRID'],
              default: 'ML'
            }
          }
        },
        Metrics: {
          type: 'object',
          properties: {
            tasks: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                pending: { type: 'integer' },
                scheduled: { type: 'integer' },
                running: { type: 'integer' },
                completed: { type: 'integer' },
                failed: { type: 'integer' }
              }
            },
            resources: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                available: { type: 'integer' },
                busy: { type: 'integer' },
                avgLoad: { type: 'number' }
              }
            },
            performance: {
              type: 'object',
              properties: {
                avgExecutionTime: { type: 'number' },
                mlAccuracy: { type: 'number' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts']
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #3b82f6; }
    `,
    customSiteTitle: 'ML Task Scheduler API Docs',
    customfavIcon: '/favicon.ico'
  }));

  // JSON spec endpoint
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 API Docs available at http://localhost:3001/api/docs');
}

export default swaggerSpec;
