// Spreading the result of this function into a describeRoute() object bypasses
// TypeScript's excess property checking (only fresh object literals are checked),
// while still embedding the x-filc_* values in the OpenAPI output at runtime.
export const filcExt = (groupName: string, typeName: string, auth = false) => ({
  'x-filc_group_name': groupName,
  'x-filc_type_name': typeName,
  ...(auth && { 'x-filc_auth': 'true' }),
});
