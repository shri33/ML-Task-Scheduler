import { PrismaClient } from '@prisma/client';
import { taskService } from './src/services/task.service';
import { schedulerService } from './src/services/scheduler.service';
import { gpuRegistryService } from './src/services/gpuRegistry.service';
import redisService from './src/lib/redis';

const prisma = new PrismaClient();

async function runTest() {
  try {
    // 1. Setup Redis Connection for this script
    await redisService.connect();

    // 2. Inject Mock GPU Node
    console.log("Registering Mock GPU Node...");
    await gpuRegistryService.registerNode({
      id: "test-h100-node",
      host: "192.168.1.100",
      gpuType: "NVIDIA-H100",
      vramTotal: 80.0,
      vramUsed: 12.5,
      utilization: 35.0,
      queue: 0,
      lastHeartbeat: Date.now()
    });

    // 3. Inject dummy PostgreSQL resource
    console.log("Injecting dummy PostgreSQL resource to bypass FK constraints...");
    await prisma.resource.upsert({
      where: { id: "00000000-0000-0000-0000-000000000000" },
      update: {},
      create: {
        id: "00000000-0000-0000-0000-000000000000",
        name: "GPU Cluster Link (Mock)",
        capacity: 100
      }
    });

    console.log("Creating new AI task...");
    const task = await taskService.create({
      name: "AI Inference Task: ViT-Large Model",
      type: "MIXED",
      size: "LARGE",
      priority: 5,
    });
    console.log("Created task:", task.id);

    console.log("Triggering Scheduler...");
    const pendingTasks = await taskService.findPending();
    const taskIds = pendingTasks.map(t => t.id);
    const results = await schedulerService.schedule(taskIds);
    console.log("\n--- Scheduling Results ---");

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    await prisma.$disconnect();
    const redisClient = redisService.getClient();
    if (redisClient) await redisClient.quit();
    process.exit(0);
  }
}

runTest();
