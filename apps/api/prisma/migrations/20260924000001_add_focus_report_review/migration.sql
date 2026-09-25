-- CreateTable
CREATE TABLE "FocusReportReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "interruptionId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL DEFAULT 'shadow-v0.1',
    "verdict" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusReportReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusReportReview_userId_reportId_idx" ON "FocusReportReview"("userId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "FocusReportReview_userId_interruptionId_policyVersion_key" ON "FocusReportReview"("userId", "interruptionId", "policyVersion");

-- AddForeignKey
ALTER TABLE "FocusReportReview" ADD CONSTRAINT "FocusReportReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
