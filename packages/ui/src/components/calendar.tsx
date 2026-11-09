/* oxlint-disable react/no-unstable-nested-components -- needed to pass types */
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react';
import { type ComponentProps, useEffect, useRef } from 'react';
import {
  type DayButton,
  DayPicker,
  getDefaultClassNames,
} from 'react-day-picker';

import { cn } from '../lib/utils';
import { Button, buttonVariants } from './button';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  formatters,
  components,
  ...props
}: ComponentProps<typeof DayPicker> & {
  buttonVariant?: ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();
  const localeCode = (props.locale as { code?: string } | undefined)?.code;

  return (
    <DayPicker
      captionLayout={captionLayout}
      className={cn(
        'group/calendar bg-background p-3 [--cell-radius:var(--radius-4xl)] [--cell-size:--spacing(8)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className
      )}
      classNames={{
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_next
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous
        ),
        caption_label: cn(
          'font-medium select-none',
          captionLayout === 'label'
            ? 'text-sm'
            : 'cn-calendar-caption-label [&>svg]:text-muted-foreground flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5',
          defaultClassNames.caption_label
        ),
        day: cn(
          'group/day relative aspect-square h-full w-full rounded-(--cell-radius) p-0 text-center select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)',
          props.showWeekNumber
            ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)'
            : '[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)',
          defaultClassNames.day
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled
        ),
        dropdown: cn(
          'bg-popover absolute inset-0 opacity-0',
          defaultClassNames.dropdown
        ),
        dropdown_root: cn(
          'cn-calendar-dropdown-root relative rounded-(--cell-radius)',
          defaultClassNames.dropdown_root
        ),
        dropdowns: cn(
          'flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium',
          defaultClassNames.dropdowns
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption
        ),
        month_grid: 'w-full border-collapse',
        months: cn(
          'relative flex flex-col gap-4 md:flex-row',
          defaultClassNames.months
        ),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside
        ),
        range_end: cn(
          'bg-muted after:bg-muted relative isolate z-0 rounded-r-(--cell-radius) after:absolute after:inset-y-0 after:left-0 after:w-4',
          defaultClassNames.range_end
        ),
        range_middle: cn('rounded-none', defaultClassNames.range_middle),
        range_start: cn(
          'elative bg-muted after:bg-muted isolate z-0 rounded-l-(--cell-radius) after:absolute after:inset-y-0 after:right-0 after:w-4',
          defaultClassNames.range_start
        ),
        root: cn('w-fit', defaultClassNames.root),
        today: cn(
          'bg-muted text-foreground rounded-(--cell-radius) data-[selected=true]:rounded-none',
          defaultClassNames.today
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        week_number: cn(
          'text-muted-foreground text-[0.8rem] select-none',
          defaultClassNames.week_number
        ),
        week_number_header: cn(
          'w-(--cell-size) select-none',
          defaultClassNames.week_number_header
        ),
        weekday: cn(
          'text-muted-foreground flex-1 rounded-(--cell-radius) text-[0.8rem] font-normal select-none',
          defaultClassNames.weekday
        ),
        weekdays: cn('flex', defaultClassNames.weekdays),
        ...classNames,
      }}
      components={{
        Chevron: ({
          className: chevronClassName,
          orientation,
          ...chevronProps
        }) => {
          if (orientation === 'left') {
            return (
              <ChevronLeftIcon
                className={cn('size-4', chevronClassName)}
                {...chevronProps}
              />
            );
          }

          if (orientation === 'right') {
            return (
              <ChevronRightIcon
                className={cn('size-4', chevronClassName)}
                {...chevronProps}
              />
            );
          }

          return (
            <ChevronDownIcon
              className={cn('size-4', chevronClassName)}
              {...chevronProps}
            />
          );
        },
        DayButton: CalendarDayButton,
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
          <div
            className={cn(rootClassName)}
            data-slot="calendar"
            ref={rootRef}
            {...rootProps}
            translate="no"
          />
        ),
        WeekNumber: ({ children, ...weekNumberProps }) => (
          <td {...weekNumberProps}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      formatters={{
        formatMonthDropdown: (date) =>
          new Intl.DateTimeFormat(localeCode, { month: 'short' }).format(date),
        ...formatters,
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();

  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) {
      ref.current?.focus();
    }
  }, [modifiers.focused]);

  return (
    <Button
      className={cn(
        'data-[range-end=true]:bg-primary data-[range-middle=true]:bg-muted data-[range-start=true]:bg-primary data-[selected-single=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-middle=true]:text-foreground data-[range-start=true]:text-primary-foreground data-[selected-single=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-foreground relative isolate z-10 flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 border-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:rounded-r-(--cell-radius) data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:rounded-l-(--cell-radius) [&>span]:text-xs [&>span]:opacity-70',
        defaultClassNames.day,
        className
      )}
      data-day={day.date.toLocaleDateString()}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      data-range-start={modifiers.range_start}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      size="icon"
      variant="ghost"
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
