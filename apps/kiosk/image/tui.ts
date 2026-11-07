/**
 * Zero-dependency terminal UI: raw-mode keypresses plus an ANSI block renderer.
 *
 * Deliberately not blessed/ink/opentui: this script runs under `sudo`, and root
 * has no `node_modules` on this host. The only runtime is the Bun binary itself,
 * so the renderer sits on top of `node:readline`'s keypress events.
 *
 * Geometry rule, observed by every prompt: a block ends with a newline so the
 * cursor rests on a fresh line below it. To redraw, move up the number of lines
 * just written and clear below — anything else eats the line above the block.
 */

import { emitKeypressEvents } from 'node:readline';

export type Key = {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  sequence: string;
};

/**
 * NB: raw mode is what makes this work — a piped stdin never emits keypresses
 * and the prompts would hang forever, so callers must check `isInteractive()`
 * before entering the TUI.
 */
export function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY);
}

/**
 * Keypress queue fed by ONE permanent listener.
 *
 * Attaching and detaching the listener per `readKey()` drops keys that arrive
 * while it is detached — and a PTY delivers a whole typed line in one burst, so
 * `dd` confirmation strings arrived as a lost prefix. The queue keeps every
 * key that crossed the pipe until a prompt asks for it.
 */
const keyQueue: Key[] = [];
const waiters: ((key: Key) => void)[] = [];
let listenerAttached = false;

function normalizeKey(sequence: string, key: Key): Key {
  // A PTY in raw mode reports \r as `return`; a cooked stdin emits \n. Fold both
  // into one name so the handlers check a single key.
  const name = key.name === 'return' || sequence === '\n' ? 'return' : key.name;
  // A PTY reports the space bar as ESC+space (meta); the prompts mean a bare
  // space, so drop the meta flag from it.
  const meta = name === 'space' ? false : key.meta;
  return { ...key, meta, name };
}

export function startKeyListener(): void {
  if (listenerAttached) {
    return;
  }
  listenerAttached = true;
  process.stdin.on('keypress', (sequence: string, key: Key) => {
    const normalized = normalizeKey(sequence, key);
    const waiter = waiters.shift();
    if (waiter) {
      waiter(normalized);
      return;
    }
    keyQueue.push(normalized);
  });
}

/** Resolves on the next keypress, preserving the order the keys arrived in. */
export function readKey(): Promise<Key> {
  startKeyListener();
  const queued = keyQueue.shift();
  if (queued) {
    return Promise.resolve(queued);
  }
  const { promise, resolve } = Promise.withResolvers<Key>();
  waiters.push(resolve);
  return promise;
}

export function enableRawMode(): void {
  const stdin = process.stdin as NodeJS.ReadStream & {
    setRawMode?: (mode: boolean) => void;
  };
  stdin.setEncoding('utf8');
  stdin.setRawMode?.(true);
  emitKeypressEvents(stdin);
  stdin.resume();
}

export function disableRawMode(): void {
  const stdin = process.stdin as NodeJS.ReadStream & {
    setRawMode?: (mode: boolean) => void;
  };
  stdin.pause();
  stdin.setRawMode?.(false);
}

export const ANSI = {
  bold: '\x1B[1m',
  clear: '\x1B[2J\x1B[H',
  // Erase the current line and return to column 0 — in place. The spinner frame
  // leaves the cursor on its own line, so moving up (1A) climbed into the block
  // above it; only a cursor-restoring erase is safe for a line that is redrawn.
  clearLine: '\x1B[2K\r',
  cyan: '\x1B[36m',
  dim: '\x1B[2m',
  green: '\x1B[32m',
  hideCursor: '\x1B[?25l',
  inverse: '\x1B[7m',
  red: '\x1B[31m',
  reset: '\x1B[0m',
  showCursor: '\x1B[?25h',
  yellow: '\x1B[33m',
} as const;

/** Moves the cursor up `count` lines and erases everything below it. */
function moveUpAndClear(count: number): void {
  // [K erases to end of line and is required for every line the block touched:
  // [J alone clears the region but leaves the cursor where it was, so a line that
  // is now shorter than the one it replaced keeps its trailing characters.
  for (let line = 0; line < count; line += 1) {
    process.stdout.write('\x1B[A\x1B[K');
  }
}

export type Choice = {
  label: string;
  value: string;
  hint?: string;
};

/**
 * In-place redraw of one block. The block always ends with a newline, so the
 * cursor sits on the line below it and moving up the written-line count restores
 * the block's first line.
 */
function makeDraw(footer: string) {
  let drawn = 0;
  return (lines: string[]) => {
    if (drawn > 0) {
      moveUpAndClear(drawn);
    }
    process.stdout.write(
      `${[...lines, `${ANSI.dim}${footer}${ANSI.reset}`].join('\n')}\n`
    );
    drawn = lines.length + 1;
  };
}

/** Writes one line without disturbing the block above it. */
export function println(line = ''): void {
  process.stdout.write(`${line}\n`);
}

/** Spinner frame, rewritten on the same line each tick. */
export function renderSpinner(message: string, frame: number): void {
  const frames = ['|', '/', '-', '\\'];
  const columns = Math.max(20, process.stdout.columns ?? 80);
  const prefix = `${frames[frame % frames.length]} `;
  // One terminal row only: a wrapped frame cannot be erased in place, so its
  // tail would survive under the next one.
  const room = columns - 1 - prefix.length;
  const label =
    message.length > room
      ? `${message.slice(0, Math.max(0, room - 1))}…`
      : message;
  process.stdout.write(
    `${ANSI.clearLine}${ANSI.cyan}${prefix}${label}${ANSI.reset}`
  );
}

/** Replaces the spinner line with a final result line. */
export function finishSpinner(message: string, ok = true): void {
  const mark = ok ? `${ANSI.green}✓${ANSI.reset}` : `${ANSI.red}✗${ANSI.reset}`;
  process.stdout.write(`${ANSI.clearLine}${mark} ${message}\n`);
}

/** Every prompt answers to these; ctrl-c cancels too. */
function isConfirm(key: Key): boolean {
  return key.name === 'return';
}

function isCancel(key: Key): boolean {
  return key.name === 'escape' || (key.ctrl && key.name === 'c');
}

/** Up/down and vi j/k. Returns null when the key does not move the cursor. */
function moveIndex(key: Key, current: number, length: number): number | null {
  if (key.name === 'up' || key.name === 'k') {
    return current > 0 ? current - 1 : length - 1;
  }
  if (key.name === 'down' || key.name === 'j') {
    return current < length - 1 ? current + 1 : 0;
  }
  return null;
}

/**
 * Highlights the focused row. The unfocused row keeps the same visual width so
 * the highlight does not shift the list as it moves; the cursor mark is the only
 * other signal, which is what terminal lists conventionally use.
 */
function rowLabel(label: string, focused: boolean): string {
  return focused ? `${ANSI.inverse} ${label} ${ANSI.reset}` : ` ${label} `;
}

const CURSOR_MARK = `${ANSI.cyan}›${ANSI.reset}`;

function rowCursor(focused: boolean): string {
  return focused ? CURSOR_MARK : ' ';
}

/**
 * The list loop shared by select and multiSelect. `onKey` handles the keys the
 * variant cares about; returning a value ends the prompt.
 */
async function runListPrompt(
  onKey: (key: Key) => string[] | null
): Promise<string[]> {
  for (;;) {
    const key = await readKey();
    if (isCancel(key)) {
      throw new ExitError('Cancelled');
    }
    const result = onKey(key);
    if (result) {
      return result;
    }
  }
}

/**
 * Single-select radio list. Arrows move, enter picks. `initial` is an index.
 */
export async function select(
  title: string,
  choices: Choice[],
  initial = 0
): Promise<string> {
  let index = Math.max(0, Math.min(initial, choices.length - 1));

  const paint = (): string[] => {
    const lines = [`${ANSI.bold}${title}${ANSI.reset}`];
    for (const [i, choice] of choices.entries()) {
      const focused = i === index;
      const hint = choice.hint
        ? `  ${ANSI.dim}${choice.hint}${ANSI.reset}`
        : '';
      lines.push(
        `${rowCursor(focused)}${rowLabel(choice.label, focused)}${hint}`
      );
    }
    return lines;
  };

  const draw = makeDraw('↑↓ move · enter select');
  draw(paint());

  const [value] = await runListPrompt((key) => {
    const moved = moveIndex(key, index, choices.length);
    if (moved !== null) {
      index = moved;
      draw(paint());
      return null;
    }
    if (isConfirm(key)) {
      return [choices[index]?.value ?? ''];
    }
    return null;
  });
  return value ?? '';
}

/**
 * Multi-select checkbox list. Space toggles, enter confirms. `initial` holds the
 * values that start selected; the answer is in the order the choices list them.
 */
export async function multiSelect(
  title: string,
  choices: Choice[],
  initial: string[] = []
): Promise<string[]> {
  const selected = new Set(initial);
  let index = 0;

  const paint = (): string[] => {
    const lines = [`${ANSI.bold}${title}${ANSI.reset}`];
    for (const [i, choice] of choices.entries()) {
      const focused = i === index;
      const on = selected.has(choice.value);
      const box = on ? `${ANSI.green}[x]${ANSI.reset}` : '[ ]';
      const hint = choice.hint
        ? `  ${ANSI.dim}${choice.hint}${ANSI.reset}`
        : '';
      lines.push(
        `${rowCursor(focused)}${box} ${rowLabel(choice.label, focused)}${hint}`
      );
    }
    return lines;
  };

  const draw = makeDraw('↑↓ move · space toggle · enter confirm');
  draw(paint());

  return await runListPrompt((key) => {
    const moved = moveIndex(key, index, choices.length);
    if (moved !== null) {
      index = moved;
      draw(paint());
      return null;
    }
    if (key.name === 'space') {
      const value = choices[index]?.value ?? '';
      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }
      draw(paint());
      return null;
    }
    if (isConfirm(key)) {
      return choices
        .filter((choice) => selected.has(choice.value))
        .map((c) => c.value);
    }
    return null;
  });
}

/** Boolean toggle, rendered as a yes/no pair. */
export async function toggle(
  title: string,
  initial: boolean,
  hint?: string
): Promise<boolean> {
  let value = initial;

  const paint = (): string[] => {
    const yes = value
      ? `${ANSI.inverse} yes ${ANSI.reset}`
      : `${ANSI.dim} yes ${ANSI.reset}`;
    const no = value
      ? `${ANSI.dim} no  ${ANSI.reset}`
      : `${ANSI.inverse} no  ${ANSI.reset}`;
    const lines = [`${ANSI.bold}${title}${ANSI.reset}`, `${yes}  ${no}`];
    if (hint) {
      lines.push(`${ANSI.dim}${hint}${ANSI.reset}`);
    }
    return lines;
  };

  const draw = makeDraw('← → switch · enter select');
  draw(paint());

  for (;;) {
    const key = await readKey();
    if (isCancel(key)) {
      throw new ExitError('Cancelled');
    }
    if (
      key.name === 'left' ||
      key.name === 'right' ||
      key.name === 'h' ||
      key.name === 'l' ||
      key.name === 'space' ||
      key.name === 'tab'
    ) {
      value = !value;
      draw(paint());
    } else if (isConfirm(key)) {
      return value;
    } else {
      draw(paint());
    }
  }
}

/** Free-text input, drawn with the buffer inverted so the caret is visible. */
export async function text(
  title: string,
  initial = '',
  hint?: string
): Promise<string> {
  let buffer = initial;

  const paint = (): string[] => {
    const lines = [`${ANSI.bold}${title}${ANSI.reset}`];
    if (hint) {
      lines.push(`${ANSI.dim}${hint}${ANSI.reset}`);
    }
    lines.push(`${ANSI.inverse} ${buffer} ${ANSI.reset}`);
    return lines;
  };

  const draw = makeDraw('type · enter submit · backspace delete');
  draw(paint());

  for (;;) {
    const key = await readKey();
    if (isCancel(key)) {
      throw new ExitError('Cancelled');
    }
    if (isConfirm(key)) {
      return buffer;
    }
    if (key.name === 'backspace') {
      buffer = buffer.slice(0, -1);
    } else if (key.name === 'space') {
      buffer += ' ';
    } else if (key.sequence && key.sequence.length === 1) {
      buffer += key.sequence;
    }
    draw(paint());
  }
}

/**
 * Confirmation for the destructive step: the user types the device path, so a
 * stray keypress can never reach `dd`. Anything other than an exact match aborts.
 */
export async function confirmByTyping(
  title: string,
  detail: string[],
  confirmWord: string
): Promise<boolean> {
  let typed = '';

  const paint = (): string[] => [
    `${ANSI.red}${ANSI.bold}! ${title}${ANSI.reset}`,
    ...detail.map((line) => `  ${line}`),
    `${ANSI.bold}Type ${confirmWord} to continue:${ANSI.reset} ${ANSI.inverse} ${typed} ${ANSI.reset}`,
  ];

  const draw = makeDraw('anything else aborts');
  draw(paint());

  for (;;) {
    const key = await readKey();
    if (isCancel(key)) {
      return false;
    }
    if (isConfirm(key)) {
      return typed.trim() === confirmWord;
    }
    if (key.name === 'backspace') {
      typed = typed.slice(0, -1);
    } else if (key.sequence && key.sequence.length === 1) {
      typed += key.sequence;
    }
    draw(paint());
  }
}

/** Thrown by any prompt when the user hits escape or ctrl-c. */
export class ExitError extends Error {}

/** Prints a boxed summary block. */
export function renderSummary(lines: string[]): void {
  const width = Math.max(...lines.map((line) => line.length), 40) + 4;
  const rule = '─'.repeat(width);
  const boxed = lines.map(
    (line) =>
      `${ANSI.dim}│${ANSI.reset} ${line.padEnd(width - 2)}${ANSI.dim}│${ANSI.reset}`
  );
  println(`${ANSI.dim}╭${rule}╮${ANSI.reset}`);
  for (const line of boxed) {
    println(line);
  }
  println(`${ANSI.dim}╰${rule}╯${ANSI.reset}`);
}
