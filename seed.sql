-- Seed the database with users, resources, and tasks
-- Password hash is bcrypt of 'password123'

-- Users
INSERT INTO "User" (id, email, password, name, role, "isActive", "updatedAt") VALUES
  (gen_random_uuid(), 'admin@example.com', '$2a$10$Y5HzTAinMWYNzqUywOKHxegAtt1mlFxJqLWwEKnaF7wIaZowD5x5W', 'Admin User', 'ADMIN', true, NOW()),
  (gen_random_uuid(), 'demo@example.com', '$2a$10$Y5HzTAinMWYNzqUywOKHxegAtt1mlFxJqLWwEKnaF7wIaZowD5x5W', 'Demo User', 'USER', true, NOW()),
  (gen_random_uuid(), 'viewer@example.com', '$2a$10$Y5HzTAinMWYNzqUywOKHxegAtt1mlFxJqLWwEKnaF7wIaZowD5x5W', 'Viewer User', 'VIEWER', true, NOW())
ON CONFLICT (email) DO NOTHING;

-- Resources (fog nodes matching the paper's architecture)
INSERT INTO "Resource" (id, name, capacity, "currentLoad", status, "updatedAt") VALUES
  (gen_random_uuid(), 'Fog Node F1 - Assembly Line', 100, 35, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F2 - CNC Processing', 85, 20, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F3 - Quality Inspection', 120, 15, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F4 - Welding Station', 75, 45, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F5 - Packaging Unit', 90, 10, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F6 - Material Handling', 60, 50, 'BUSY', NOW()),
  (gen_random_uuid(), 'Fog Node F7 - Paint Shop', 110, 25, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F8 - Inventory Storage', 95, 0, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F9 - Testing Lab', 130, 60, 'AVAILABLE', NOW()),
  (gen_random_uuid(), 'Fog Node F10 - Dispatch Center', 80, 0, 'OFFLINE', NOW())
ON CONFLICT DO NOTHING;

-- Tasks
INSERT INTO "Task" (id, name, type, size, priority, status, "dueDate", "predictedTime", "updatedAt") VALUES
  (gen_random_uuid(), 'Fault Detection - Line A', 'CPU', 'LARGE', 5, 'PENDING', NOW() + INTERVAL '1 day', 120.5, NOW()),
  (gen_random_uuid(), 'Production Scheduling Optimization', 'CPU', 'LARGE', 5, 'PENDING', NOW() + INTERVAL '2 days', 90.0, NOW()),
  (gen_random_uuid(), 'Inventory Sync - Warehouse B', 'IO', 'MEDIUM', 4, 'PENDING', NOW() + INTERVAL '1 day', 45.0, NOW()),
  (gen_random_uuid(), 'Quality Inspection - Batch 47', 'MIXED', 'MEDIUM', 4, 'PENDING', NOW() + INTERVAL '12 hours', 60.0, NOW()),
  (gen_random_uuid(), 'Real-time Monitoring Dashboard', 'CPU', 'SMALL', 3, 'PENDING', NOW() + INTERVAL '6 hours', 15.0, NOW()),
  (gen_random_uuid(), 'Device State Analysis - Motor Unit', 'MIXED', 'LARGE', 5, 'PENDING', NOW() + INTERVAL '1 day', 85.0, NOW()),
  (gen_random_uuid(), 'Conveyor Belt Speed Optimization', 'CPU', 'MEDIUM', 3, 'PENDING', NOW() + INTERVAL '2 days', 40.0, NOW()),
  (gen_random_uuid(), 'Energy Consumption Report', 'IO', 'SMALL', 2, 'PENDING', NOW() + INTERVAL '3 days', 20.0, NOW()),
  (gen_random_uuid(), 'AGV Route Planning', 'CPU', 'LARGE', 4, 'PENDING', NOW() + INTERVAL '1 day', 100.0, NOW()),
  (gen_random_uuid(), 'Product Defect Classification', 'MIXED', 'MEDIUM', 4, 'PENDING', NOW() + INTERVAL '8 hours', 55.0, NOW()),
  (gen_random_uuid(), 'Sensor Data Aggregation', 'IO', 'SMALL', 2, 'PENDING', NOW() + INTERVAL '4 days', 10.0, NOW()),
  (gen_random_uuid(), 'CNC Program Compilation', 'CPU', 'MEDIUM', 3, 'PENDING', NOW() + INTERVAL '1 day', 35.0, NOW()),
  (gen_random_uuid(), 'Maintenance Schedule Generation', 'MIXED', 'SMALL', 2, 'PENDING', NOW() + INTERVAL '5 days', 25.0, NOW()),
  (gen_random_uuid(), 'Paint Quality Analysis', 'CPU', 'LARGE', 4, 'PENDING', NOW() + INTERVAL '12 hours', 75.0, NOW()),
  (gen_random_uuid(), 'Assembly Line Balancing', 'CPU', 'LARGE', 5, 'PENDING', NOW() + INTERVAL '6 hours', 110.0, NOW())
ON CONFLICT DO NOTHING;
