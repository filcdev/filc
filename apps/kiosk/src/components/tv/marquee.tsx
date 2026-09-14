type MarqueeProps = {
  className?: string;
  text: string;
};

/** One scrolling line of text: a doubled track translated by half its width,
 *  so the loop is seamless. Speed follows the text length — a long list of
 *  announcements must still be readable. */
export function Marquee({ className, text }: MarqueeProps) {
  const seconds = Math.min(90, Math.max(15, Math.round(text.length * 0.25)));

  return (
    <div
      className={className ? `overflow-hidden ${className}` : 'overflow-hidden'}
    >
      <div
        className="marquee-track"
        style={{ animationDuration: `${seconds}s` }}
      >
        <span className="pr-16">{text}</span>
        <span aria-hidden={true} className="pr-16">
          {text}
        </span>
      </div>
    </div>
  );
}
