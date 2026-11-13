import { Avatar as AvatarPrimitive } from '@base-ui/react/avatar';
import { type ComponentProps, useEffect, useRef } from 'react';

import { cn } from '../lib/utils';

function Avatar({
  className,
  size = 'default',
  ...props
}: AvatarPrimitive.Root.Props & {
  size?: 'default' | 'sm' | 'lg';
}) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'group/avatar after:border-border relative flex size-8 shrink-0 rounded-full select-none after:absolute after:inset-0 after:rounded-full after:border after:mix-blend-darken data-[size=lg]:size-10 data-[size=sm]:size-6 dark:after:mix-blend-lighten',
        className
      )}
      data-size={size}
      data-slot="avatar"
      {...props}
    />
  );
}

/**
 * The avatar's picture, painted over the fallback.
 *
 * A plain `<img>` rather than Base UI's `Avatar.Image`: that one probes the
 * source from an effect and mounts its element only after the probe loads, so
 * the server render carries no `<img>` at all — the browser cannot start the
 * request until hydration and then loads the picture a second time. Rendering
 * the element here puts it in the SSR markup, so the load starts with the
 * document, and the initials underneath stay visible until the bytes arrive.
 * A source that fails hides the element, revealing them again.
 *
 * With no source there is no element at all: a source-less `<img>` still paints
 * a broken-image glyph (and its `alt` text) over the initials.
 */
function AvatarImage({
  alt = '',
  className,
  onError,
  onLoad,
  src,
  ...props
}: ComponentProps<'img'>) {
  const imageRef = useRef<HTMLImageElement | null>(null);

  // The element comes from the server render, so a source that 404s can fail
  // before React hydrates — that error never reaches `onError`. Check once per
  // source what the browser already knows.
  useEffect(() => {
    const image = imageRef.current;
    if (!image || image.getAttribute('src') !== src) {
      return;
    }
    if (image.complete && image.naturalWidth === 0) {
      image.hidden = true;
    }
  }, [src]);

  if (!(src || props.srcSet)) {
    return null;
  }

  return (
    // the picture is sized by its container; its intrinsic size is the upload's.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a failing <img> reports an error event, not an interaction.
    <img
      alt={alt}
      className={cn(
        'absolute inset-0 aspect-square size-full rounded-full object-cover',
        className
      )}
      data-slot="avatar-image"
      decoding="async"
      onError={(event) => {
        event.currentTarget.hidden = true;
        onError?.(event);
      }}
      onLoad={(event) => {
        // A replaced source clears the failure the previous one marked.
        event.currentTarget.hidden = false;
        onLoad?.(event);
      }}
      ref={imageRef}
      src={src}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-sm group-data-[size=sm]/avatar:text-xs',
        className
      )}
      data-slot="avatar-fallback"
      {...props}
    />
  );
}

function AvatarBadge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-blend-color ring-2 select-none',
        'group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden',
        'group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2',
        'group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2',
        className
      )}
      data-slot="avatar-badge"
      {...props}
    />
  );
}

function AvatarGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group/avatar-group *:data-[slot=avatar]:ring-background flex -space-x-2 *:data-[slot=avatar]:ring-2',
        className
      )}
      data-slot="avatar-group"
      {...props}
    />
  );
}

function AvatarGroupCount({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-muted text-muted-foreground ring-background relative flex size-8 shrink-0 items-center justify-center rounded-full text-sm ring-2 group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4 group-has-data-[size=lg]/avatar-group:[&>svg]:size-5 group-has-data-[size=sm]/avatar-group:[&>svg]:size-3',
        className
      )}
      data-slot="avatar-group-count"
      {...props}
    />
  );
}

export {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
};
