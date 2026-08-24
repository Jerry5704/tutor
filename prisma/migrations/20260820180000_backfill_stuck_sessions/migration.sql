UPDATE "SessionObjectiveState" state
SET "consecutiveStruggles" = 2
FROM "StudySession" session
WHERE state."sessionId" = session."id"
  AND state."learningObjectiveId" = session."currentObjectiveId"
  AND session."phase" = 'LEARNING'
  AND session."endedAt" IS NULL
  AND session."scaffoldLevel" >= 3
  AND state."workedExamplesShown" = 0;
