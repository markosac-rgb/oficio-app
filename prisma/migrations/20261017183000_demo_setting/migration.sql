-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN "isExample" BOOLEAN NOT NULL DEFAULT false;
