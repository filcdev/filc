---
description: "Use when building or editing Iris dialogs, admin forms, doorlock forms, TanStack Form usage, or submit flows in apps/iris/src/components."
applyTo: "apps/iris/src/components/**/*dialog.tsx"
---
# Iris Dialog Form Procedure

- Follow the dialog structure used in files like [apps/iris/src/components/doorlock/card-dialog.tsx](../../apps/iris/src/components/doorlock/card-dialog.tsx) and [apps/iris/src/components/admin/user-dialog.tsx](../../apps/iris/src/components/admin/user-dialog.tsx): create the form near the top of the component, derive reactive slices with `useStore(form.store, selector)`, and render fields with `<form.Field>{(field) => ...}</form.Field>`.
- Reuse validation schemas from [apps/iris/src/utils/form-schemas.ts](../../apps/iris/src/utils/form-schemas.ts) when available. If a schema becomes shared by multiple dialogs, move it there instead of copying validation logic.
- `form.reset` takes raw values, not `{ values: ... }`. Because `form.reset` and `form.setFieldValue` are not stable dependencies, do not add them to `useEffect` arrays when synchronizing dialog state.
- Reuse or extend shared dialog prop types such as [apps/iris/src/components/admin/admin.types.ts](../../apps/iris/src/components/admin/admin.types.ts) and [apps/iris/src/components/doorlock/doorlock.types.ts](../../apps/iris/src/components/doorlock/doorlock.types.ts) instead of defining near-duplicate props in each dialog.
- Keep submit side effects together: mutation success should close the dialog, invalidate the relevant query keys, and surface translated success or failure feedback.
- New labels, button text, placeholders, and empty states belong in `t(...)` and the locale files, even if older dialogs still have hardcoded strings.