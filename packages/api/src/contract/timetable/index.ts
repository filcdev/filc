import { importContract } from './import';
import { lessonsContract } from './lessons';
import { movedLessonsContract } from './moved-lessons';
import { peopleContract } from './people';
import { substitutionsContract } from './substitutions';
import { timetablesContract } from './timetables';

/**
 * The whole `timetable` feature: the timetable lifecycle, the XML import, the
 * rooms/cohorts/groups/periods/subjects/teachers it is built from, and the
 * curriculum (lessons, substitutions, moved lessons) taught in it.
 */
export const timetableContract = {
  ...timetablesContract,
  ...importContract,
  ...peopleContract,
  ...lessonsContract,
  ...substitutionsContract,
  ...movedLessonsContract,
};
