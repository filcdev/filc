import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { HU_LAYOUT } from '@/components/keyboard/layouts';
import { OnScreenKeyboard } from '@/components/keyboard/on-screen-keyboard';

type Editable = HTMLInputElement | HTMLTextAreaElement;

/** Input types the keyboard handles. Others (number, date, checkbox…) are
 *  left alone — they don't support text-caret editing the same way. */
const TEXT_INPUT_TYPES: Record<string, true> = {
  '': true,
  email: true,
  password: true,
  search: true,
  tel: true,
  text: true,
  url: true,
};

function isEditable(element: EventTarget | null): element is Editable {
  if (element instanceof HTMLTextAreaElement) {
    return true;
  }

  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES[element.type] === true;
  }

  return false;
}

/** Set an input/textarea value through the native setter so React's change
 *  tracking fires `onChange` for controlled components. */
function setNativeValue(element: Editable, value: string): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Wrap the kiosk shell in this provider; any text input/textarea that takes
 * focus pops up an on-screen keyboard, which disappears when focus leaves. Mark
 * an input (or any ancestor) with `data-no-keyboard` to opt it out.
 *
 * The listener is on the document, not the wrapper: the shared UI package
 * renders popovers, dialogs and menus through a portal, so a focused field can
 * live outside this subtree and still needs the keyboard.
 */
export function VirtualKeyboardProvider({ children }: { children: ReactNode }) {
  const activeRef = useRef<Editable | null>(null);
  const hideTimer = useRef<number | null>(null);

  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(false);

  const close = useCallback(() => {
    activeRef.current?.blur();
    activeRef.current = null;
    setOpen(false);
  }, []);

  // Auto-attach: watch focus moving in/out of editable fields. focusin/
  // focusout bubble to the document, so one pair of listeners covers both the
  // shell and anything the UI package portals out of it.
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!isEditable(target)) {
        return;
      }
      if (target.closest('[data-no-keyboard]')) {
        return;
      }
      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
      }
      activeRef.current = target;
      setShift(false);
      setOpen(true);
    };

    // Defer hiding so moving focus directly to another field doesn't flash
    // the keyboard closed (the next focusin cancels this).
    const onFocusOut = () => {
      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
      }
      hideTimer.current = window.setTimeout(() => {
        activeRef.current = null;
        setOpen(false);
      }, 150);
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      if (hideTimer.current !== null) {
        clearTimeout(hideTimer.current);
      }
    };
  }, []);

  // Restore the caret after React re-renders the controlled value.
  const restoreCaret = useCallback((element: Editable, caret: number) => {
    requestAnimationFrame(() => {
      element.focus();
      // Not every input type supports a text selection (email, number).
      if (typeof element.setSelectionRange === 'function') {
        element.setSelectionRange(caret, caret);
      }
    });
  }, []);

  const insert = useCallback(
    (text: string) => {
      const element = activeRef.current;
      if (!element) {
        return;
      }
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? element.value.length;
      const next =
        element.value.slice(0, start) + text + element.value.slice(end);
      setNativeValue(element, next);
      restoreCaret(element, start + text.length);
    },
    [restoreCaret]
  );

  const onChar = useCallback(
    (char: string) => {
      insert(char);
      setShift(false); // one-shot shift
    },
    [insert]
  );

  const onBackspace = useCallback(() => {
    const element = activeRef.current;
    if (!element) {
      return;
    }
    let start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    if (start === end) {
      if (start === 0) {
        return;
      }
      start -= 1;
    }
    const next = element.value.slice(0, start) + element.value.slice(end);
    setNativeValue(element, next);
    restoreCaret(element, start);
  }, [restoreCaret]);

  return (
    <>
      {children}

      {open && (
        <OnScreenKeyboard
          layout={HU_LAYOUT}
          onBackspace={onBackspace}
          onChar={onChar}
          onClose={close}
          onEnter={close}
          onShift={() => setShift((previous) => !previous)}
          onSpace={() => insert(' ')}
          shift={shift}
        />
      )}
    </>
  );
}
