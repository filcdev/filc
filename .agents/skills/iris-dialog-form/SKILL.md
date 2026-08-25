---
name: iris-dialog-form
description: Procedures for building or editing Iris dialogs, admin forms, doorlock forms, TanStack Form usage, or submit flows in apps/iris/src/components. Use when creating *dialog.tsx components, form validation schemas, or mutation-driven submit flows.
---
# Iris Dialog Form Procedure

- Follow the dialog structure used in `apps/iris/src/components/admin/user-dialog.tsx`: create the form near the top of the component, derive reactive slices with `useStore(form.store, selector)`, and render fields with `<form.Field>{(field) => ...}</form.Field>`.
- Reuse validation schemas from `apps/iris/src/utils/form-schemas.ts` when available. For validation against backend wire shapes, reuse the domain contracts from `packages/api/src/domains` (`@filcdev/api/domains/<name>`) — e.g. the bug-report dialog validates with `createBugReportSchema`. Move a schema to the shared location once it has multiple consumers instead of copying it.
- `form.reset` takes raw values, not `{ values: ... }`. Because `form.reset` and `form.setFieldValue` are not stable dependencies, do not add them to `useEffect` arrays when synchronizing dialog state.
- Extend shared dialog prop types such as `apps/iris/src/components/admin/admin.types.ts` and `apps/iris/src/components/doorlock/doorlock.types.ts` instead of defining near-duplicate props in each dialog.
- Keep submit side effects together: mutation success should close the dialog, invalidate the relevant query keys, and surface translated success or failure feedback.
- New labels, button text, placeholders, and empty states belong in `t(...)` and both locale trees, even if older dialogs still have hardcoded strings.
