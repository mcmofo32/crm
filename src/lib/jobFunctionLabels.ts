import { JobFunction } from "@/generated/prisma/client";

/** Voluit geschreven omschrijving van elke functie, getoond op dropdowns en het organigram. */
export const JOB_FUNCTION_LABELS: Record<JobFunction, string> = {
  FT1: "Financial Trainee 1",
  FT2: "Financial Trainee 2",
  FT3: "Financial Trainee 3",
  FTC: "Financial Trainee Coach",
  FA: "Financial Advisor",
  FC: "Financial Consultant",
  DC: "District Coordinator",
  RC: "Regional Coordinator",
  NC: "National Coordinator",
};
