import {
  colorFromSubject,
  formatRooms,
  formatRoomsShort,
  formatTeachersShort,
} from './helpers';
import type { LessonItem } from './types';

export function LessonCard({ lesson }: { lesson: LessonItem }) {
  const subject = lesson.subject?.name ?? '—';
  const short = lesson.subject?.short ?? subject;
  const teacherShort = formatTeachersShort(lesson.teachers);
  const room = formatRooms(lesson.classrooms);
  const roomShort = formatRoomsShort(lesson.classrooms);
  const color = colorFromSubject(subject);

  return (
    <div
      className="flex items-center justify-between rounded-md border border-border p-1.5 shadow-sm print:border-black/50 print:shadow-none"
      style={{ backgroundColor: `${color}1a`, borderColor: `${color}33` }}
    >
      <div className="font-semibold text-base text-foreground leading-6">
        {short}
      </div>
      <div className="mt-0.5 flex flex-col items-end space-y-0.5 text-muted-foreground text-xs">
        <div className="truncate">
          <span>{teacherShort}</span>
        </div>
        {room || roomShort ? (
          <div className="truncate">
            <span className="hidden sm:inline">{room}</span>
            <span className="sm:hidden">{roomShort}</span>
          </div>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
    </div>
  );
}
