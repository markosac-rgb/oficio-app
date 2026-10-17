-- AlterTable
ALTER TABLE "User" ADD COLUMN "acceptedLegalVersion" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "acceptedSecondaryPurposes" BOOLEAN NOT NULL DEFAULT false;
