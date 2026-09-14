import type {
  EditKind,
  EditorAppearance,
  EditTarget,
} from '@filcdev/navigator-3d/editor/types';
import type { ResizePatch } from '@filcdev/navigator-3d/types/three/gizmo-types';
import { type AnyFormApi, useStore } from '@tanstack/react-form';
import { useCallback, useState } from 'react';

type EditorValues = { id?: string };

type NavigatorEditorOptions<TValues extends EditorValues> = {
  /** The TanStack Form instance the drag patches are folded into. */
  form: AnyFormApi;
  /** Which entity kind the gizmo edits. */
  kind: EditKind;
  /** Map the form's live values to the partial entity the canvas previews. */
  toPreview: (values: TValues) => EditTarget['preview'];
};

/**
 * Editing state machine shared by every navigator entity page: the form is
 * the single source of truth, so the typed inputs and the gizmo drag both
 * land in the same values object and the canvas previews unsaved edits.
 */
export function useNavigatorEditor<TValues extends EditorValues>({
  form,
  kind,
  toPreview,
}: NavigatorEditorOptions<TValues>) {
  const values = useStore(form.store, (state) => state.values) as TValues;
  // null = no editor, {} = creating, { id } = editing an existing entity.
  const [editState, setEditState] = useState<{ id?: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const edit: EditTarget | null = editState
    ? ({ id: editState.id, kind, preview: toPreview(values) } as EditTarget)
    : null;

  let highlightIds: string[] = [];
  if (editState?.id) {
    highlightIds = [editState.id];
  } else if (hoveredId) {
    highlightIds = [hoveredId];
  }

  const appearance: EditorAppearance = {
    emphasis: {
      dimOthers: editState !== null || hoveredId !== null,
      highlightIds,
      kind,
    },
  };

  /**
   * Enter the editor for the entity the given values describe: the form is
   * reset to them (so an existing entity's fields are actually populated) and
   * the gizmo is pointed at the same entity. `keepDefaultValues` is required —
   * `useForm` re-applies the `defaultValues` it was constructed with on every
   * render, which would undo a reset that replaced them.
   */
  const beginEdit = useCallback(
    (formValues: TValues) => {
      form.reset(formValues, { keepDefaultValues: true });
      setEditState({ id: formValues.id || undefined });
    },
    [form]
  );

  /** Leave the editor and clear any hover highlight. */
  const closeEdit = useCallback(() => {
    setEditState(null);
    setHoveredId(null);
  }, []);

  /** Fold a gizmo drag patch into the form so preview and inputs stay in sync. */
  const foldPatch = useCallback(
    (patch: ResizePatch) => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) {
          form.setFieldValue(key as never, value as never);
        }
      }
    },
    [form]
  );

  return {
    appearance,
    beginEdit,
    closeEdit,
    edit,
    foldPatch,
    hoveredId,
    isEditing: editState !== null,
    setHoveredId,
  };
}
