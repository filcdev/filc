import { Button } from '@filcdev/ui/components/button';
import { Input } from '@filcdev/ui/components/input';
import { Spinner } from '@filcdev/ui/components/spinner';
import { CameraOff, RotateCw } from 'lucide-react';
import { type FormEvent, useCallback, useId, useRef, useState } from 'react';
import { LocaleToggle } from '@/components/locale-toggle';
import { ResultPanel } from '@/components/result-panel';
import { type ScanEvent, useCheckin } from '@/hooks/events';
import { useScanner } from '@/hooks/scanner';
import { formatWhen, type ScanLocale, type ScanStrings } from '@/i18n';

type Props = {
  event: ScanEvent;
  locale: ScanLocale;
  onExit: () => void;
  onLocaleChange: (locale: ScanLocale) => void;
  strings: ScanStrings;
};

/**
 * The door itself: camera on top, manual code underneath whenever the screen
 * is ready for a scan.
 *
 * The camera pauses on a result (or on a failed request) and only restarts on
 * "next", so one QR cannot be scanned twice by a hand that shakes. A refused
 * camera permission is not a dead end — the manual field keeps working and is
 * never hidden behind the keyboard: it sits in the normal flow, not pinned to
 * the viewport.
 */
export const ScannerScreen = ({
  event,
  locale,
  onExit,
  onLocaleChange,
  strings: s,
}: Props) => {
  const { error, isPending, reset, result, submit } = useCheckin(event.id);
  const [manual, setManual] = useState('');
  const [cameraReady, setCameraReady] = useState(false);
  const busy = useRef(false);
  const manualId = useId();

  const paused = result !== null || error !== null;

  const handleCode = useCallback(
    (code: string) => {
      const trimmed = code.trim();
      if (!trimmed || busy.current) {
        return;
      }
      busy.current = true;
      submit(trimmed);
    },
    [submit]
  );

  const { failure, retry, videoRef } = useScanner(!paused, handleCode);

  const handleManualSubmit = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    handleCode(manual);
  };

  const handleNext = () => {
    busy.current = false;
    setManual('');
    reset();
  };

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <header className="flex items-center justify-between gap-2 px-2 py-2">
        <Button
          className="shrink-0 text-muted-foreground"
          onClick={onExit}
          size="lg"
          type="button"
          variant="ghost"
        >
          {s.changeEvent}
        </Button>
        <div className="min-w-0 text-center">
          <p className="truncate font-semibold text-sm">{event.title}</p>
          <p className="truncate text-muted-foreground text-xs">
            {formatWhen(event.startsAt, locale)}
          </p>
        </div>
        <LocaleToggle
          label={s.localeSwitch}
          locale={locale}
          onChange={onLocaleChange}
        />
      </header>

      <div className="relative mx-4 min-h-64 flex-1 overflow-hidden rounded-2xl bg-zinc-950">
        <video
          className="size-full object-cover"
          muted
          onPlaying={() => setCameraReady(true)}
          playsInline
          ref={videoRef}
        />

        {result ? (
          <ResultPanel
            locale={locale}
            onClose={handleNext}
            result={result}
            strings={s}
          />
        ) : null}

        {!result && failure ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-zinc-200">
            <CameraOff className="size-12" strokeWidth={1.75} />
            <p className="text-balance text-sm">
              {failure === 'denied' ? s.cameraDenied : s.cameraUnavailable}
            </p>
            <Button
              className="border-zinc-600 text-zinc-100 hover:bg-zinc-800"
              onClick={retry}
              type="button"
              variant="outline"
            >
              <RotateCw />
              {s.retryCamera}
            </Button>
          </div>
        ) : null}

        {result || failure || cameraReady ? null : (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-300">
            <Spinner />
            <span>{s.cameraStarting}</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {paused ? (
          <>
            {error ? (
              <p className="text-balance text-center text-destructive text-sm">
                {s.checkFailed}
              </p>
            ) : null}
            <Button
              className="h-14 w-full text-base"
              onClick={handleNext}
              type="button"
            >
              {s.resultNext}
            </Button>
          </>
        ) : (
          <form className="flex flex-col gap-2" onSubmit={handleManualSubmit}>
            <label className="font-medium text-sm" htmlFor={manualId}>
              {s.manualLabel}
            </label>
            <div className="flex gap-2">
              <Input
                autoComplete="off"
                autoCorrect="off"
                className="h-12 rounded-xl"
                enterKeyHint="go"
                id={manualId}
                inputMode="text"
                onChange={(changeEvent) => setManual(changeEvent.target.value)}
                placeholder={s.manualPlaceholder}
                spellCheck={false}
                value={manual}
              />
              <Button
                className="h-12 shrink-0 px-5"
                disabled={isPending || manual.trim().length === 0}
                type="submit"
              >
                {isPending ? s.checkingIn : s.manualSubmit}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
};
