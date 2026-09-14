import { Alert, AlertTitle } from '@filcdev/ui/components/alert';
import { Spinner } from '@filcdev/ui/components/spinner';
import { TriangleAlert } from 'lucide-react';
import { TV_STRINGS } from '@/components/tv/strings';

export function Loading() {
  return (
    <div className="flex h-full items-center justify-center gap-3">
      <Spinner className="size-8" />
      <span className="animate-pulse">{TV_STRINGS.loading}</span>
    </div>
  );
}

export function QueryError() {
  return (
    <div className="flex h-full items-center justify-center">
      <Alert className="w-auto bg-transparent" variant="destructive">
        <TriangleAlert />
        <AlertTitle>{TV_STRINGS.error}</AlertTitle>
      </Alert>
    </div>
  );
}
