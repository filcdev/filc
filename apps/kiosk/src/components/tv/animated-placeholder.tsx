import { Pacman } from '@/components/tv/pacman';

type AnimatedPlaceholderProps = {
  title: string;
};

/** The "nothing to show" mascot the ticker shows for an empty table. */
export function AnimatedPlaceholder({ title }: AnimatedPlaceholderProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex items-center gap-2">
        <Pacman className="-mr-3 size-9 text-primary" />
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            className="h-2 w-2 animate-pulse rounded-full bg-primary"
            key={dot}
            style={{
              animationDelay: `${dot * 0.1}s`,
              animationDuration: '2s',
            }}
          />
        ))}
      </div>
      <span className="mt-2 animate-fade-in font-semibold text-xl">
        {title}
      </span>
    </div>
  );
}
