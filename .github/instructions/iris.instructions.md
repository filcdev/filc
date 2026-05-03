---
description: "Use when editing Iris frontend code, React routes, TanStack Router pages, TanStack Query or Form usage, admin or doorlock dialogs, or i18n text in apps/iris."
applyTo: "apps/iris/**"
---
# Iris Frontend Guidelines

- For common frontend tasks, also use the focused procedure guides: [Iris data flow procedure](iris-data-flow.instructions.md) and [Iris dialog form procedure](iris-dialog-form.instructions.md).

- Keep user-facing text in `t(...)` and update both locale trees under [apps/iris/public/locales/en](../../apps/iris/public/locales/en) and [apps/iris/public/locales/hu](../../apps/iris/public/locales/hu).
- Treat [apps/iris/src/route-tree.gen.ts](../../apps/iris/src/route-tree.gen.ts) as generated. Change source files under [apps/iris/src/routes](../../apps/iris/src/routes) instead.
- Reuse shared helpers before adding local ones: [apps/iris/src/utils/query-keys.ts](../../apps/iris/src/utils/query-keys.ts), [apps/iris/src/hooks/use-has-permission.ts](../../apps/iris/src/hooks/use-has-permission.ts), [apps/iris/src/components/admin/admin.types.ts](../../apps/iris/src/components/admin/admin.types.ts), and [apps/iris/src/components/doorlock/doorlock.types.ts](../../apps/iris/src/components/doorlock/doorlock.types.ts).
- TanStack Form is the default form pattern. Follow examples like [apps/iris/src/components/doorlock/card-dialog.tsx](../../apps/iris/src/components/doorlock/card-dialog.tsx): `useForm`, `useStore(form.store, selector)`, and `<form.Field>{(field) => ...}</form.Field>`.
- `form.reset(values)` takes raw values, not `{ values }`. `form.reset` and `form.setFieldValue` are not stable `useEffect` dependencies, so omit them from dependency arrays when needed.
- Base UI dropdown wrappers use `onClick`, not Radix-style `onSelect`, unless the local component explicitly exposes a different API.
- [apps/iris/src/components/ui/chart.tsx](../../apps/iris/src/components/ui/chart.tsx) already owns `ResponsiveContainer`; do not wrap chart children in another one.
- Keep public timetable filter state in TanStack Router search params instead of duplicating it in unrelated local state.