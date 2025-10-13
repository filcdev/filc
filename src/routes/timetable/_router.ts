import { Hono } from "hono";
import { importRoute } from "~/routes/timetable/import";
import {
  createSubstitution,
  deleteSubstitution,
  getAllSubstitutions,
  getRelevantSubstitutions,
  getRelevantSubstitutionsForCohort,
  updateSubstitution,
} from "~/routes/timetable/substitution";
import type { Context } from "~/utils/globals";
import { getLessonsForCohort } from "./lesson";
import {
  createMovedLesson,
  deleteMovedLesson,
  getAllMovedLessons,
  getMovedLessonsForCohort,
  getRelevantMovedLessons,
  updateMovedLesson,
} from "~/routes/timetable/movedLesson";

export const timetableRouter = new Hono<Context>()
  .post("/import", ...importRoute)
  // Substitution routes
  .get("/substitutions", ...getAllSubstitutions)
  .get("/substitutions/relevant", ...getRelevantSubstitutions)
  .get("/substitutions/cohort/:cohortId", ...getRelevantSubstitutionsForCohort)
  .post("/substitutions", ...createSubstitution)
  .put("/substitutions/:id", ...updateSubstitution)
  .delete("/substitutions/:id", ...deleteSubstitution)
  // Moved lesson routes
  .get("/moved-lessons", ...getAllMovedLessons)
  .get("/moved-lessons/relevant", ...getRelevantMovedLessons)
  .get("/moved-lessons/cohort/:cohortId", ...getMovedLessonsForCohort)
  .get("/moved-lessons/cohort/:cohortId/relevant", ...getRelevantMovedLessons)
  .post("/moved-lessons", ...createMovedLesson)
  .put("/moved-lessons/:id", ...updateMovedLesson)
  .delete("/moved-lessons/:id", ...deleteMovedLesson)
  // Lesson routes
  .get("/lessons/get_for_cohort/:cohort_id", ...getLessonsForCohort);
