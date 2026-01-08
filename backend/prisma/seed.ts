import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create resources
  const resources = await Promise.all([
    prisma.resource.create({
      data: { name: 'Server-A', capacity: 10, currentLoad: 25 }
    }),
    prisma.resource.create({
      data: { name: 'Server-B', capacity: 8, currentLoad: 45 }
    }),
    prisma.resource.create({
      data: { name: 'Server-C', capacity: 12, currentLoad: 15 }
    }),
    prisma.resource.create({
      data: { name: 'Server-D', capacity: 6, currentLoad: 60 }
    }),
    prisma.resource.create({
      data: { name: 'Worker-1', capacity: 5, currentLoad: 0 }
    })
  ]);

  console.log(`✅ Created ${resources.length} resources`);

  // Create sample tasks
  const tasks = await Promise.all([
    prisma.task.create({
      data: { name: 'Data Processing Job', type: 'CPU', size: 'LARGE', priority: 5 }
    }),
    prisma.task.create({
      data: { name: 'File Upload Handler', type: 'IO', size: 'MEDIUM', priority: 3 }
    }),
    prisma.task.create({
      data: { name: 'Report Generation', type: 'MIXED', size: 'LARGE', priority: 4 }
    }),
    prisma.task.create({
      data: { name: 'Image Compression', type: 'CPU', size: 'SMALL', priority: 2 }
    }),
    prisma.task.create({
      data: { name: 'Database Backup', type: 'IO', size: 'LARGE', priority: 5 }
    }),
    prisma.task.create({
      data: { name: 'Email Notification', type: 'IO', size: 'SMALL', priority: 1 }
    }),
    prisma.task.create({
      data: { name: 'Video Encoding', type: 'CPU', size: 'LARGE', priority: 3 }
    }),
    prisma.task.create({
      data: { name: 'Log Analysis', type: 'MIXED', size: 'MEDIUM', priority: 2 }
    })
  ]);

  console.log(`✅ Created ${tasks.length} tasks`);

  console.log('🎉 Seeding completed!');
}

seed()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
