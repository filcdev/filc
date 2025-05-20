export type Insert<T> = T extends { $inferInsert: infer U } ? U : never
export type Select<T> = T extends { $inferSelect: infer U } ? U : never