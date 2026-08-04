-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "battery" INTEGER NOT NULL,
    "charging" BOOLEAN NOT NULL,
    "activity" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "location" TEXT,
    "motion" TEXT,
    "heartRate" INTEGER,
    "currentTask" TEXT,
    "focusLevel" INTEGER,
    "calendarStatus" TEXT,
    "workingMode" TEXT,
    "deviceStatus" TEXT,
    "manualNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContextSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contextSnapshotId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "signalsUsed" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionExplanation" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "rulesAttribution" DOUBLE PRECISION NOT NULL,
    "semanticsAttribution" DOUBLE PRECISION NOT NULL,
    "mlAttribution" DOUBLE PRECISION NOT NULL,
    "historyAttribution" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionExplanation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "originalDecision" TEXT NOT NULL,
    "userAction" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "conditionJson" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryEpisode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT,
    "decisionId" TEXT,
    "contextSnapshotId" TEXT,
    "decisionType" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "matchedRules" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "feedbackSummary" TEXT,
    "outcome" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" DOUBLE PRECISION[],
    "embeddingVersion" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsRollup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalEvents" INTEGER NOT NULL,
    "immediateCount" INTEGER NOT NULL,
    "delayedCount" INTEGER NOT NULL,
    "silencedCount" INTEGER NOT NULL,
    "overridesCount" INTEGER NOT NULL,
    "attentionHoursSaved" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsRollup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriticEvaluation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "suggestedRuleChanges" JSONB NOT NULL,
    "rawPrompt" TEXT NOT NULL,
    "rawResponse" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CriticEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Workspace_userId_idx" ON "Workspace"("userId");

-- CreateIndex
CREATE INDEX "ContextSnapshot_userId_createdAt_idx" ON "ContextSnapshot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_userId_createdAt_idx" ON "Event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_userId_status_idx" ON "Event"("userId", "status");

-- CreateIndex
CREATE INDEX "Event_userId_category_idx" ON "Event"("userId", "category");

-- CreateIndex
CREATE INDEX "Event_workspaceId_idx" ON "Event"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Decision_eventId_key" ON "Decision"("eventId");

-- CreateIndex
CREATE INDEX "Decision_eventId_idx" ON "Decision"("eventId");

-- CreateIndex
CREATE INDEX "Decision_contextSnapshotId_idx" ON "Decision"("contextSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "DecisionExplanation_decisionId_key" ON "DecisionExplanation"("decisionId");

-- CreateIndex
CREATE INDEX "Feedback_decisionId_idx" ON "Feedback"("decisionId");

-- CreateIndex
CREATE INDEX "Rule_userId_isActive_idx" ON "Rule"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryEpisode_decisionId_key" ON "MemoryEpisode"("decisionId");

-- CreateIndex
CREATE INDEX "MemoryEpisode_userId_createdAt_idx" ON "MemoryEpisode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MemoryEpisode_userId_outcome_decisionType_idx" ON "MemoryEpisode"("userId", "outcome", "decisionType");

-- CreateIndex
CREATE INDEX "MemoryEpisode_userId_embeddingVersion_idx" ON "MemoryEpisode"("userId", "embeddingVersion");

-- CreateIndex
CREATE INDEX "AnalyticsRollup_userId_date_idx" ON "AnalyticsRollup"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsRollup_userId_date_key" ON "AnalyticsRollup"("userId", "date");

-- CreateIndex
CREATE INDEX "CriticEvaluation_userId_createdAt_idx" ON "CriticEvaluation"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextSnapshot" ADD CONSTRAINT "ContextSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_contextSnapshotId_fkey" FOREIGN KEY ("contextSnapshotId") REFERENCES "ContextSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionExplanation" ADD CONSTRAINT "DecisionExplanation_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEpisode" ADD CONSTRAINT "MemoryEpisode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEpisode" ADD CONSTRAINT "MemoryEpisode_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEpisode" ADD CONSTRAINT "MemoryEpisode_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryEpisode" ADD CONSTRAINT "MemoryEpisode_contextSnapshotId_fkey" FOREIGN KEY ("contextSnapshotId") REFERENCES "ContextSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsRollup" ADD CONSTRAINT "AnalyticsRollup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriticEvaluation" ADD CONSTRAINT "CriticEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
