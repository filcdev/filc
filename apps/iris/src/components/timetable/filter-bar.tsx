import {
  Building2,
  CheckIcon,
  ChevronsUpDownIcon,
  GraduationCap,
  Printer,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils';
import { filterLabelFor } from './helpers';
import type {
  ClassroomItem,
  CohortItem,
  FilterType,
  TeacherItem,
} from './types';

const teacherLabel = (t: TeacherItem): string =>
  `${t.firstName} ${t.lastName}`.trim() || 'Teacher';

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
  const filterSelectId = `filter-${activeFilter}`;
  const comboboxContentId = `${filterSelectId}-content`;
  const selectWidthClassName = activeFilter === 'class' ? 'w-40' : 'w-60';
  const filterLabel = filterLabelFor(activeFilter);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  let filterOptions: { label: string; value: string }[];
  if (activeFilter === 'class') {
    filterOptions = (cohorts ?? []).map((c) => ({
      label: c.name,
      value: c.id,
    }));
  } else if (activeFilter === 'teacher') {
    filterOptions = (teachers ?? []).map((t) => ({
      label: teacherLabel(t),
      value: t.id,
    }));
  } else {
    filterOptions = (classrooms ?? []).map((c) => ({
      label: c.name,
      value: c.id,
    }));
  }

  let selectedValue: string;
  if (activeFilter === 'class') {
    selectedValue = selectedByClass ?? '';
  } else if (activeFilter === 'teacher') {
    selectedValue = selectedByTeacher ?? '';
  } else {
    selectedValue = selectedByRoom ?? '';
  }

  const placeholderLabel = `Select ${filterLabel.toLowerCase()}...`;
  const selectedLabel =
    filterOptions.find((option) => option.value === selectedValue)?.label ??
    placeholderLabel;

  const handleSelection = (value: string) => {
    setComboboxOpen(false);

    if (activeFilter === 'class') {
      onSelectClass(value);
      return;
    }

    if (activeFilter === 'teacher') {
      onSelectTeacher(value);
      return;
    }

    onSelectRoom(value);
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
            <CommandInput
              placeholder={`Search ${filterLabel.toLowerCase()}...`}
            />
            <CommandList>
              <CommandEmpty>No {filterLabel.toLowerCase()} found.</CommandEmpty>
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
            <GraduationCap /> Class
          </Button>
          <Button
            disabled={activeFilter === 'teacher'}
            onClick={() => onFilterChange('teacher')}
            variant="outline"
          >
            <UserRound /> Teacher
          </Button>
          <Button
            disabled={activeFilter === 'classroom'}
            onClick={() => onFilterChange('classroom')}
            variant="outline"
          >
            <Building2 /> Classroom
          </Button>
          {renderSelect()}
        </ButtonGroup>
      </div>

      <div className="flex items-center gap-2">
        <Button disabled={disabled} onClick={onPrint} variant="outline">
          <Printer /> Print / PDF
        </Button>
        <Separator className="h-6" orientation="vertical" />
      </div>
    </div>
  );
}
