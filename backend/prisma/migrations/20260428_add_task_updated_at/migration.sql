-- AlterTable: Add updatedAt to Task
ALTER TABLE "Task" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable: Add onDelete CASCADE to ScheduleHistory.resourceId
ALTER TABLE "ScheduleHistory" DROP CONSTRAINT IF EXISTS "ScheduleHistory_resourceId_fkey";
ALTER TABLE "ScheduleHistory" ADD CONSTRAINT "ScheduleHistory_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
