import {
  CANVAS_BG_DARK,
  CANVAS_BG_LIGHT,
} from '@filcdev/navigator-3d/types/three/material-types';
import { useSearch } from '@tanstack/react-router';

/** The navigator canvas background: `?theme=dark` on the box URL picks the
 *  dark palette; the language switcher toolbar's moon/sun button writes it
 *  back. Light is the default. */
export function useNavigatorCanvasBackground(): number {
  const { theme } = useSearch({ strict: false }) as { theme?: string };
  return theme === 'dark' ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;
}
