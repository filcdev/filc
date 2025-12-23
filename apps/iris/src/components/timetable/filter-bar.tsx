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
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils';

import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  TeacherItem,
} from './types';

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
  if (activeFilter === 'class') {
    return (cohorts ?? []).map((c) => ({ label: c.name, value: c.id }));
  }
  if (activeFilter === 'teacher') {
    return (teachers ?? []).map((teacher) => ({
      label: teacherLabel(teacher, t('timetable.teacherFallback')),
      value: teacher.id,
    }));
  }
  return (classrooms ?? []).map((c) => ({ label: c.name, value: c.id }));
};

const getSelectedValue = (
  activeFilter: FilterType,
  selectedByClass: string | null,
  selectedByTeacher: string | null,
  selectedByRoom: string | null
): string => {
  if (activeFilter === 'class') {
    return selectedByClass ?? '';
  }
  if (activeFilter === 'teacher') {
    return selectedByTeacher ?? '';
  }
  return selectedByRoom ?? '';
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

export function FilterBar({
  activeFilter,
  onFilterChange,
  cohorts,
  teachers,
  classrooms,
  selectedByClass,
  selectedByTeacher,
  selectedByRoom,
  onSelectClass,
  onSelectTeacher,
  onSelectRoom,
  selectorLoading,
  onPrint,
  disabled,
}: {
  activeFilter: FilterType;
  onFilterChange: (value: FilterType) => void;
  cohorts?: CohortItem[];
  teachers?: TeacherItem[];
  classrooms?: ClassroomItem[];
  selectedByClass: string | null;
  selectedByTeacher: string | null;
  selectedByRoom: string | null;
  onSelectClass: (value: string) => void;
  onSelectTeacher: (value: string) => void;
  onSelectRoom: (value: string) => void;
  selectorLoading: boolean;
  onPrint: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const filterSelectId = `filter-${activeFilter}`;
  const comboboxContentId = `${filterSelectId}-content`;
  const selectWidthClassName = activeFilter === 'class' ? 'w-40' : 'w-60';
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
  const placeholderLabel = getPlaceholder(activeFilter, t);
  const selectedLabel =
    filterOptions.find((option) => option.value === selectedValue)?.label ??
    placeholderLabel;

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
      return <Skeleton className={`h-9 ${selectWidthClassName}`} />;
    }

    return (
      <Popover onOpenChange={setComboboxOpen} open={comboboxOpen}>
        <PopoverTrigger
          render={
            <Button
              aria-controls={comboboxContentId}
              aria-expanded={comboboxOpen}
              className={`h-9 ${selectWidthClassName} justify-between`}
              id={filterSelectId}
              role="combobox"
              size="sm"
              variant="outline"
            >
              {selectedLabel}
              <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          }
        />
        <PopoverContent
          className={`${selectWidthClassName} p-0`}
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
    <div className="flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <ButtonGroup>
          <Button
            disabled={activeFilter === 'class'}
            onClick={() => onFilterChange('class')}
            variant="outline"
          >
            <GraduationCap /> {t('timetable.filterByClass')}
          </Button>
          <Button
            disabled={activeFilter === 'teacher'}
            onClick={() => onFilterChange('teacher')}
            variant="outline"
          >
            <UserRound /> {t('timetable.filterByTeacher')}
          </Button>
          <Button
            disabled={activeFilter === 'classroom'}
            onClick={() => onFilterChange('classroom')}
            variant="outline"
          >
            <Building2 /> {t('timetable.filterByClassroom')}
          </Button>
          {renderSelect()}
        </ButtonGroup>
      </div>

      <Button disabled={disabled} onClick={onPrint} variant="outline">
        <Printer /> {t('timetable.printPdf')}
      </Button>
    </div>
  );
}
