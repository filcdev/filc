// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const enumToPgEnum = <T extends Record<string, any>>(
    myEnum: T,
): [T[keyof T], ...T[keyof T][]] => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return Object.values(myEnum).map((value: any) => `${value}`) as any;
};
