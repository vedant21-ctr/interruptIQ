-- AlterTable
ALTER TABLE "FocusReportReview" ADD COLUMN     "reasonCode" TEXT,
ADD COLUMN     "focusState" TEXT,
ADD COLUMN     "outcome" TEXT,
ADD COLUMN     "channelType" TEXT,
ADD COLUMN     "mentionType" TEXT,
ADD COLUMN     "hasUrgencySignal" BOOLEAN,
ADD COLUMN     "harmCategory" TEXT;
