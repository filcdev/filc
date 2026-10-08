import { Button } from '@filcdev/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@filcdev/ui/components/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@filcdev/ui/components/popover';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@filcdev/ui/components/toggle-group';
import { cn } from '@filcdev/ui/lib/utils';
import {
  Building2,
  CheckIcon,
  ChevronsUpDownIcon,
  GraduationCap,
  Printer,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeekFilter } from './helpers';
import { TimetableSelector } from './timetable-selector';
import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  TeacherItem,
  TimetableItem,
} from './types';
import { WeekSelector } from './week-selector';

const teacherLabel = (t: TeacherItem, fallback: string): string =>
  `${t.firstName} ${t.lastName}`.trim() || fallback;

const getFilterOptions = (
  activeFilter: FilterType,
  options: {
    cohorts?: CohortItem[];
    teachers?: TeacherItem[];
    classrooms?: ClassroomItem[];
    t: (key: string) => string;
  }
): { label: string; value: string }[] => {
  const { cohorts, teachers, classrooms, t } = options;

  switch (activeFilter) {
    case 'class':
      return (cohorts ?? []).map((cohort) => ({
        label: cohort.name,
        value: cohort.id,
      }));
    case 'teacher':
      return (teachers ?? []).map((teacher) => ({
        label: teacherLabel(teacher, t('unknown')),
        value: teacher.id,
      }));
    case 'classroom':
      return (classrooms ?? []).map((classroom) => ({
        label: classroom.name,
        value: classroom.id,
      }));
    default:
      return [];
  }
};

const getSelectedValue = (
  activeFilter: FilterType,
  selectedByClass: string | null,
  selectedByTeacher: string | null,
  selectedByRoom: string | null
): string | null => {
  switch (activeFilter) {
    case 'class':
      return selectedByClass;
    case 'teacher':
      return selectedByTeacher;
    case 'classroom':
      return selectedByRoom;
    default:
      return null;
  }
};

const getPlaceholder = (
  activeFilter: FilterType,
  t: (key: string) => string
): string => {
  const placeholders = {
    class: 'timetable.selectClass',
    classroom: 'timetable.selectClassroom',
    teacher: 'timetable.selectTeacher',
  };
  return t(placeholders[activeFilter]);
};

const getSearchPlaceholder = (
  activeFilter: FilterType,
  t: (key: string) => string
): string => {
  const placeholders = {
    class: 'timetable.searchClass',
    classroom: 'timetable.searchClassroom',
    teacher: 'timetable.searchTeacher',
  };
  return t(placeholders[activeFilter]);
};

const getEmptyMessage = (
  activeFilter: FilterType,
  t: (key: string) => string
): string => {
  const messages = {
    class: 'timetable.noClassFound',
    classroom: 'timetable.noClassroomFound',
    teacher: 'timetable.noTeacherFound',
  };
  return t(messages[activeFilter]);
};

const FILTERS: {
  filter: FilterType;
  icon: typeof GraduationCap;
  labelKey: string;
}[] = [
  { filter: 'class', icon: GraduationCap, labelKey: 'timetable.filterByClass' },
  {
    filter: 'teacher',
    icon: UserRound,
    labelKey: 'timetable.filterByTeacher',
  },
  {
    filter: 'classroom',
    icon: Building2,
    labelKey: 'timetable.filterByClassroom',
  },
];

/**
 * The timetable toolbar: who to show, which timetable, which week, and the
 * print action, in one bar.
 *
 * Every control shares one box — the segmented track — so the bar reads as a
 * single object rather than a row of unrelated buttons. It wraps instead of
 * overflowing: on a narrow screen each group takes a full row, and nothing
 * scrolls sideways.
 */
export function FilterBar({
  activeFilter,
  onFilterChange,
  cohorts,
  teachers,
  classrooms,
  timetables,
  selectedByClass,
  selectedByTeacher,
  selectedByRoom,
  selectedTimetableId,
  onSelectClass,
  onSelectTeacher,
  onSelectRoom,
  onSelectTimetable,
  selectorLoading,
  onPrint,
  disabled,
  weekFilter,
  onWeekFilterChange,
}: {
  activeFilter: FilterType;
  onFilterChange: (value: FilterType) => void;
  cohorts?: CohortItem[];
  teachers?: TeacherItem[];
  classrooms?: ClassroomItem[];
  timetables?: TimetableItem[];
  selectedByClass: string | null;
  selectedByTeacher: string | null;
  selectedByRoom: string | null;
  selectedTimetableId: string | null;
  onSelectClass: (value: string) => void;
  onSelectTeacher: (value: string) => void;
  onSelectRoom: (value: string) => void;
  onSelectTimetable: (value: string) => void;
  selectorLoading: boolean;
  onPrint: () => void;
  disabled?: boolean;
  weekFilter: WeekFilter;
  onWeekFilterChange: (value: WeekFilter) => void;
}) {
  const { t } = useTranslation();
  const filterSelectId = `filter-${activeFilter}`;
  const comboboxContentId = `${filterSelectId}-content`;
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const filterOptions = getFilterOptions(activeFilter, {
    classrooms,
    cohorts,
    t,
    teachers,
  });
  const selectedValue = getSelectedValue(
    activeFilter,
    selectedByClass,
    selectedByTeacher,
    selectedByRoom
  );
  const selectedLabel =
    filterOptions.find((option) => option.value === selectedValue)?.label ??
    getPlaceholder(activeFilter, t);

  const handleSelection = (value: string) => {
    setComboboxOpen(false);
    const handlers = {
      class: onSelectClass,
      classroom: onSelectRoom,
      teacher: onSelectTeacher,
    };
    handlers[activeFilter](value);
  };

  const renderSelect = () => {
    if (selectorLoading) {
      return <Skeleton className="h-9 w-full min-w-40 sm:w-56" />;
    }

    return (
      <Popover onOpenChange={setComboboxOpen} open={comboboxOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-controls={comboboxContentId}
              aria-expanded={comboboxOpen}
              className="h-9 w-full min-w-0 justify-between font-medium text-sm"
              id={filterSelectId}
              role="combobox"
              variant="outline"
            >
              <span className="truncate">{selectedLabel}</span>
              <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent
          className="w-[var(--radix-popper-anchor-width)] p-0"
          id={comboboxContentId}
        >
          <Command>
            <CommandInput placeholder={getSearchPlaceholder(activeFilter, t)} />
            <CommandList>
              <CommandEmpty>{getEmptyMessage(activeFilter, t)}</CommandEmpty>
              <CommandGroup>
                {filterOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelection(option.value)}
                    value={option.label}
                  >
                    <CheckIcon
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedValue === option.value
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    // Two rows on a phone, one wrapping row from `sm` up. The control *labels*
    // wait for `lg` (see the segments below and the week selector): a tablet
    // cannot fit three labelled segments plus two pickers on one line, and an
    // icon-only segment is still legible where a wrapped row is not.
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Row 1: the entry type (icons only on a phone) and its picker. */}
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <ToggleGroup
          aria-label={t('timetable.filterLabel')}
          className="shrink-0"
          onValueChange={(value) => {
            const next = value[0];
            if (next) {
              onFilterChange(next as FilterType);
            }
          }}
          value={[activeFilter]}
        >
          {FILTERS.map(({ filter, icon: Icon, labelKey }) => (
            <ToggleGroupItem
              aria-label={t(labelKey)}
              className="px-2 sm:px-2.5 lg:px-3"
              disabled={disabled}
              key={filter}
              title={t(labelKey)}
              value={filter}
            >
              <Icon />
              <span className="hidden lg:inline">{t(labelKey)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <div className="min-w-0 flex-1 sm:w-52 sm:flex-none lg:w-56">
          {renderSelect()}
        </div>
      </div>

      {/* Row 2: the week, the timetable, and print. */}
      <div className="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto">
        <WeekSelector
          disabled={disabled}
          onChange={onWeekFilterChange}
          value={weekFilter}
        />

        <div className="min-w-0 flex-1 sm:w-40 sm:flex-none lg:w-44">
          <TimetableSelector
            loading={!timetables}
            onSelect={onSelectTimetable}
            selectedId={selectedTimetableId}
            timetables={timetables}
          />
        </div>

        <Button
          aria-label={t('timetable.printPdf')}
          className="shrink-0"
          disabled={disabled}
          onClick={onPrint}
          size="icon"
          variant="outline"
        >
          <Printer />
        </Button>
      </div>
    </div>
  );
}
