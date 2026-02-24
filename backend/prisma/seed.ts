import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data (in reverse order of dependencies)
  console.log('🧹 Clearing existing data...');
  await prisma.prediction.deleteMany();
  await prisma.scheduleHistory.deleteMany();
  await prisma.systemMetrics.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  console.log('👤 Creating users...');
  const seedPassword = process.env.SEED_PASSWORD || 'password123';
  if (!process.env.SEED_PASSWORD) {
    console.warn('⚠️  SEED_PASSWORD not set — using default "password123". Set SEED_PASSWORD env var for production.');
  }
  const hashedPassword = await bcrypt.hash(seedPassword, 10);
  
  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'demo@example.com',
        password: hashedPassword,
        name: 'Demo User',
        role: 'USER',
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        email: 'viewer@example.com',
        password: hashedPassword,
        name: 'Viewer User',
        role: 'VIEWER',
        isActive: true
      }
    })
  ]);
  console.log(`✅ Created ${users.length} users`);

  // Create resources (simulating fog computing nodes)
  console.log('🖥️ Creating resources...');
  const resources = await Promise.all([
    // Cloud servers (high capacity)
    prisma.resource.create({
      data: { name: 'Cloud-Server-1', capacity: 100, currentLoad: 35, status: 'AVAILABLE' }
    }),
    prisma.resource.create({
      data: { name: 'Cloud-Server-2', capacity: 100, currentLoad: 60, status: 'AVAILABLE' }
    }),
    // Edge/Fog nodes (medium capacity)
    prisma.resource.create({
      data: { name: 'Fog-Node-A', capacity: 50, currentLoad: 20, status: 'AVAILABLE' }
    }),
    prisma.resource.create({
      data: { name: 'Fog-Node-B', capacity: 50, currentLoad: 45, status: 'AVAILABLE' }
    }),
    prisma.resource.create({
      data: { name: 'Fog-Node-C', capacity: 40, currentLoad: 15, status: 'AVAILABLE' }
    }),
    // Edge devices (lower capacity)
    prisma.resource.create({
      data: { name: 'Edge-Device-1', capacity: 20, currentLoad: 10, status: 'AVAILABLE' }
    }),
    prisma.resource.create({
      data: { name: 'Edge-Device-2', capacity: 20, currentLoad: 80, status: 'BUSY' }
    }),
    prisma.resource.create({
      data: { name: 'Edge-Device-3', capacity: 15, currentLoad: 0, status: 'OFFLINE' }
    }),
    // GPU nodes (specialized)
    prisma.resource.create({
      data: { name: 'GPU-Node-1', capacity: 80, currentLoad: 50, status: 'AVAILABLE' }
    }),
    prisma.resource.create({
      data: { name: 'GPU-Node-2', capacity: 80, currentLoad: 25, status: 'AVAILABLE' }
    })
  ]);
  console.log(`✅ Created ${resources.length} resources`);

  // Create sample tasks with various statuses
  console.log('📋 Creating tasks...');
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const tasks = await Promise.all([
    // High priority tasks
    prisma.task.create({
      data: {
        name: 'Real-time Video Processing',
        type: 'CPU',
        size: 'LARGE',
        priority: 5,
        status: 'RUNNING',
        dueDate: tomorrow,
        predictedTime: 120.5,
        resourceId: resources[8].id // GPU-Node-1
      }
    }),
    prisma.task.create({
      data: {
        name: 'Critical Database Backup',
        type: 'IO',
        size: 'LARGE',
        priority: 5,
        status: 'SCHEDULED',
        dueDate: tomorrow,
        predictedTime: 45.0,
        resourceId: resources[0].id // Cloud-Server-1
      }
    }),
    prisma.task.create({
      data: {
        name: 'Security Log Analysis',
        type: 'MIXED',
        size: 'LARGE',
        priority: 5,
        status: 'PENDING',
        dueDate: tomorrow,
        predictedTime: 90.0
      }
    }),
    // Medium priority tasks
    prisma.task.create({
      data: {
        name: 'Report Generation - Q4',
        type: 'MIXED',
        size: 'MEDIUM',
        priority: 4,
        status: 'COMPLETED',
        dueDate: now,
        predictedTime: 30.0,
        actualTime: 28.5,
        resourceId: resources[2].id,
        completedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
      }
    }),
    prisma.task.create({
      data: {
        name: 'Image Batch Processing',
        type: 'CPU',
        size: 'MEDIUM',
        priority: 4,
        status: 'RUNNING',
        dueDate: nextWeek,
        predictedTime: 60.0,
        resourceId: resources[9].id // GPU-Node-2
      }
    }),
    prisma.task.create({
      data: {
        name: 'Data ETL Pipeline',
        type: 'IO',
        size: 'LARGE',
        priority: 4,
        status: 'PENDING',
        dueDate: nextWeek,
        predictedTime: 75.0
      }
    }),
    prisma.task.create({
      data: {
        name: 'ML Model Training',
        type: 'CPU',
        size: 'LARGE',
        priority: 4,
        status: 'SCHEDULED',
        dueDate: nextWeek,
        predictedTime: 180.0,
        resourceId: resources[8].id
      }
    }),
    // Regular priority tasks
    prisma.task.create({
      data: {
        name: 'Email Campaign Dispatch',
        type: 'IO',
        size: 'SMALL',
        priority: 3,
        status: 'COMPLETED',
        predictedTime: 15.0,
        actualTime: 12.0,
        resourceId: resources[3].id,
        completedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000)
      }
    }),
    prisma.task.create({
      data: {
        name: 'Thumbnail Generation',
        type: 'CPU',
        size: 'SMALL',
        priority: 3,
        status: 'RUNNING',
        predictedTime: 20.0,
        resourceId: resources[5].id // Edge-Device-1
      }
    }),
    prisma.task.create({
      data: {
        name: 'API Performance Testing',
        type: 'MIXED',
        size: 'MEDIUM',
        priority: 3,
        status: 'PENDING',
        dueDate: nextWeek,
        predictedTime: 40.0
      }
    }),
    prisma.task.create({
      data: {
        name: 'Log File Compression',
        type: 'IO',
        size: 'MEDIUM',
        priority: 3,
        status: 'SCHEDULED',
        predictedTime: 25.0,
        resourceId: resources[4].id
      }
    }),
    // Low priority tasks
    prisma.task.create({
      data: {
        name: 'Analytics Dashboard Update',
        type: 'MIXED',
        size: 'SMALL',
        priority: 2,
        status: 'PENDING',
        predictedTime: 10.0
      }
    }),
    prisma.task.create({
      data: {
        name: 'Cache Warmup',
        type: 'IO',
        size: 'SMALL',
        priority: 2,
        status: 'COMPLETED',
        predictedTime: 8.0,
        actualTime: 7.5,
        resourceId: resources[2].id,
        completedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000)
      }
    }),
    prisma.task.create({
      data: {
        name: 'System Health Report',
        type: 'MIXED',
        size: 'SMALL',
        priority: 2,
        status: 'PENDING',
        predictedTime: 5.0
      }
    }),
    // Background/maintenance tasks
    prisma.task.create({
      data: {
        name: 'Temp File Cleanup',
        type: 'IO',
        size: 'SMALL',
        priority: 1,
        status: 'COMPLETED',
        predictedTime: 3.0,
        actualTime: 2.5,
        completedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000)
      }
    }),
    prisma.task.create({
      data: {
        name: 'Notification Queue Process',
        type: 'IO',
        size: 'SMALL',
        priority: 1,
        status: 'PENDING',
        predictedTime: 5.0
      }
    }),
    // Failed task example
    prisma.task.create({
      data: {
        name: 'Legacy Data Migration',
        type: 'IO',
        size: 'LARGE',
        priority: 3,
        status: 'FAILED',
        predictedTime: 60.0,
        resourceId: resources[7].id // Edge-Device-3 (OFFLINE)
      }
    })
  ]);
  console.log(`✅ Created ${tasks.length} tasks`);

  // Create schedule history for demo
  console.log('📊 Creating schedule history...');
  const scheduleHistory = await Promise.all([
    prisma.scheduleHistory.create({
      data: {
        taskId: tasks[3].id, // Completed report generation
        resourceId: resources[2].id,
        algorithm: 'IPSO',
        mlEnabled: true,
        predictedTime: 30.0,
        actualTime: 28.5,
        score: 0.95,
        explanation: 'ML-optimized scheduling using IPSO algorithm'
      }
    }),
    prisma.scheduleHistory.create({
      data: {
        taskId: tasks[7].id, // Completed email campaign
        resourceId: resources[3].id,
        algorithm: 'IACO',
        mlEnabled: true,
        predictedTime: 15.0,
        actualTime: 12.0,
        score: 0.92,
        explanation: 'Optimized using Improved Ant Colony algorithm'
      }
    }),
    prisma.scheduleHistory.create({
      data: {
        taskId: tasks[12].id, // Completed cache warmup
        resourceId: resources[2].id,
        algorithm: 'ROUND_ROBIN',
        mlEnabled: false,
        predictedTime: 8.0,
        actualTime: 7.5,
        score: 0.88,
        explanation: 'Standard round-robin scheduling'
      }
    })
  ]);
  console.log(`✅ Created ${scheduleHistory.length} schedule history records`);

  // Create some predictions
  console.log('🔮 Creating predictions...');
  const predictions = await Promise.all([
    prisma.prediction.create({
      data: {
        taskId: tasks[0].id,
        predictedTime: 120.5,
        confidence: 0.89,
        features: { cpu_intensity: 0.9, io_intensity: 0.2, size_factor: 3 },
        modelVersion: 'v1.2.0'
      }
    }),
    prisma.prediction.create({
      data: {
        taskId: tasks[1].id,
        predictedTime: 45.0,
        confidence: 0.92,
        features: { cpu_intensity: 0.3, io_intensity: 0.8, size_factor: 3 },
        modelVersion: 'v1.2.0'
      }
    }),
    prisma.prediction.create({
      data: {
        taskId: tasks[4].id,
        predictedTime: 60.0,
        confidence: 0.85,
        features: { cpu_intensity: 0.85, io_intensity: 0.15, size_factor: 2 },
        modelVersion: 'v1.2.0'
      }
    })
  ]);
  console.log(`✅ Created ${predictions.length} predictions`);

  // Create system metrics
  console.log('📈 Creating system metrics...');
  const metricsData = [];
  const metricTypes = ['cpu_usage', 'memory_usage', 'task_throughput', 'avg_completion_time'];
  
  // Generate metrics for the last 24 hours
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    for (const metricName of metricTypes) {
      let value: number;
      switch (metricName) {
        case 'cpu_usage':
          value = 30 + Math.random() * 40; // 30-70%
          break;
        case 'memory_usage':
          value = 40 + Math.random() * 30; // 40-70%
          break;
        case 'task_throughput':
          value = 50 + Math.random() * 100; // 50-150 tasks/hour
          break;
        case 'avg_completion_time':
          value = 15 + Math.random() * 20; // 15-35 seconds
          break;
        default:
          value = Math.random() * 100;
      }
      metricsData.push({
        metricName,
        metricValue: Math.round(value * 100) / 100,
        timestamp
      });
    }
  }
  
  await prisma.systemMetrics.createMany({ data: metricsData });
  console.log(`✅ Created ${metricsData.length} system metrics`);

  // Summary
  console.log('\n🎉 Seeding completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Summary:');
  console.log(`   👤 Users: ${users.length}`);
  console.log(`   🖥️ Resources: ${resources.length}`);
  console.log(`   📋 Tasks: ${tasks.length}`);
  console.log(`   📊 Schedule History: ${scheduleHistory.length}`);
  console.log(`   🔮 Predictions: ${predictions.length}`);
  console.log(`   📈 System Metrics: ${metricsData.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔐 Demo Login Credentials:');
  console.log('   Admin:  admin@example.com / password123');
  console.log('   User:   demo@example.com / password123');
  console.log('   Viewer: viewer@example.com / password123');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
