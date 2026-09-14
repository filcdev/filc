import { Button } from '@filcdev/ui/components/button';
import type { MouseEvent } from 'react';
import type { KeyboardLayout } from '@/components/keyboard/layouts';
import { useKioskTranslations } from '@/hooks/use-kiosk-translations';

type OnScreenKeyboardProps = {
  onBackspace: () => void;
  onChar: (char: string) => void;
  onClose: () => void;
  onEnter: () => void;
  onShift: () => void;
  onSpace: () => void;
  /** Whether the next letter is shifted (one-shot). */
  shift: boolean;
  layout: KeyboardLayout;
};

/** Keep the active input focused: a key's mousedown must not steal focus. */
const keepFocus = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
};

/** The key width every character key shares inside a row. */
const KEY_CLASS = 'max-w-14 flex-1 px-0 text-base sm:text-lg';

/**
 * Presentational on-screen keyboard: a fixed bar docked to the bottom of the
 * viewport. It is purely controlled — every key calls back to the provider,
 * which owns the focused input.
 *
 * The whole panel suppresses the default mousedown so tapping a key never
 * steals focus from (and thus never blurs) the active input.
 */
export function OnScreenKeyboard({
  onBackspace,
  onChar,
  onClose,
  onEnter,
  onShift,
  onSpace,
  shift,
  layout,
}: OnScreenKeyboardProps) {
  const { t } = useKioskTranslations();
  const cap = (char: string) => (shift ? char.toLocaleUpperCase('hu') : char);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1000] select-none border-border border-t bg-muted p-2 shadow-2xl"
      data-kiosk-keyboard={true}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
        <div className="flex items-center justify-end">
          <Button
            aria-label={t('ui.keyboard.close_aria')}
            onClick={onClose}
            onMouseDown={keepFocus}
            size="sm"
            title={t('ui.keyboard.close')}
            type="button"
            variant="ghost"
          >
            ✕
          </Button>
        </div>

        {/* Character rows. */}
        {layout.rows.map((row) => (
          <div
            className="flex justify-center gap-1 sm:gap-1.5"
            key={row.join('')}
          >
            {row.map((char) => (
              <Button
                className={KEY_CLASS}
                key={char}
                onClick={() => onChar(cap(char))}
                onMouseDown={keepFocus}
                type="button"
                variant="outline"
              >
                {cap(char)}
              </Button>
            ))}
          </div>
        ))}

        {/* Control row. */}
        <div className="flex justify-center gap-1 sm:gap-1.5">
          <Button
            aria-pressed={shift}
            onClick={onShift}
            onMouseDown={keepFocus}
            title="Shift"
            type="button"
            variant={shift ? 'default' : 'secondary'}
          >
            ⇧ Shift
          </Button>
          <Button
            className="flex-1"
            onClick={onSpace}
            onMouseDown={keepFocus}
            type="button"
            variant="outline"
          >
            {t('ui.keyboard.space')}
          </Button>
          <Button
            onClick={onBackspace}
            onMouseDown={keepFocus}
            title={t('ui.common.delete')}
            type="button"
            variant="secondary"
          >
            ⌫
          </Button>
          <Button
            onClick={onEnter}
            onMouseDown={keepFocus}
            type="button"
            variant="default"
          >
            ⏎
          </Button>
        </div>
      </div>
    </div>
  );
}
