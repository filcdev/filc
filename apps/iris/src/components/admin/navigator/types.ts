import type { StandardSchemaV1 } from '@tanstack/react-form';
import type { BaseDialogProps } from '@/components/admin/admin.types';
import type {
  NavigatorBuilding,
  NavigatorClassroom,
  NavigatorClassroomType,
  NavigatorCorridor,
  NavigatorLift,
  NavigatorStair,
  NavigatorTranslation,
} from '@/hooks/navigator';

/** Props shared by every navigator record dialog. `record` null -> create, otherwise edit. */
export type NavigatorRecordDialogProps<TRecord> = BaseDialogProps & {
  record: TRecord | null;
};

export type BuildingDialogProps = NavigatorRecordDialogProps<NavigatorBuilding>;
export type ClassroomTypeDialogProps =
  NavigatorRecordDialogProps<NavigatorClassroomType>;
export type ClassroomDialogProps =
  NavigatorRecordDialogProps<NavigatorClassroom>;
export type CorridorDialogProps = NavigatorRecordDialogProps<NavigatorCorridor>;
export type LiftDialogProps = NavigatorRecordDialogProps<NavigatorLift>;
export type StairDialogProps = NavigatorRecordDialogProps<NavigatorStair>;
export type TranslationDialogProps =
  NavigatorRecordDialogProps<NavigatorTranslation>;

/**
 * Adapts a `z.coerce.number()`-based navigator form schema to the validator
 * type TanStack Form expects. `z.coerce.number()` declares an `unknown`
 * Standard-Schema input, which TanStack Form rejects against concrete
 * string-valued form data; the cast narrows the static input type while the
 * runtime coercion is preserved.
 */
export function asNavigatorFormValidator<TFormValues>(
  schema: StandardSchemaV1
): StandardSchemaV1<TFormValues, unknown> {
  return schema as StandardSchemaV1<TFormValues, unknown>;
}

/**
 * Resolves the placeholder text for a reference `Select` based on its loading
 * and empty states, avoiding a nested ternary (disallowed by the lint config).
 */
export function selectPlaceholder(
  isLoading: boolean,
  isEmpty: boolean,
  loading: string,
  empty: string,
  select: string
): string {
  if (isLoading) {
    return loading;
  }
  if (isEmpty) {
    return empty;
  }
  return select;
}
