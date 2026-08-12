-- Prestatie: ontbrekende indexen voor veelgebruikte filtercombinaties.

-- Lead: gecombineerde filters die op vrijwel elke lijst-/statistiekquery voorkomen.
CREATE INDEX "Lead_deletedAt_ownerId_idx" ON "Lead"("deletedAt", "ownerId");
CREATE INDEX "Lead_deletedAt_status_idx" ON "Lead"("deletedAt", "status");
CREATE INDEX "Lead_caseManagerUserId_idx" ON "Lead"("caseManagerUserId");
CREATE INDEX "Lead_caseManagerSubagentId_idx" ON "Lead"("caseManagerSubagentId");

-- LeadStageChange: had nog geen enkele index ondanks constant gebruik in
-- analyse-/productiequeries (changedAt-range, leadId, toStageId, changedById).
CREATE INDEX "LeadStageChange_changedAt_idx" ON "LeadStageChange"("changedAt");
CREATE INDEX "LeadStageChange_leadId_idx" ON "LeadStageChange"("leadId");
CREATE INDEX "LeadStageChange_toStageId_idx" ON "LeadStageChange"("toStageId");
CREATE INDEX "LeadStageChange_changedById_idx" ON "LeadStageChange"("changedById");

-- Activity: status/scheduledAt-combinatie voor takenoverzicht en incentives.
CREATE INDEX "Activity_assigneeId_status_idx" ON "Activity"("assigneeId", "status");
CREATE INDEX "Activity_status_scheduledAt_idx" ON "Activity"("status", "scheduledAt");
