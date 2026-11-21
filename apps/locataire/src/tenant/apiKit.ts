import { z } from 'zod';

export const timestamp = z.iso.datetime({ offset: true });

export const pageOf = <Item extends z.ZodType>(item: Item) =>
  z.object({ data: z.array(item), meta: z.object({ next_cursor: z.string().nullable() }) });

export const oneOf = <Item extends z.ZodType>(item: Item) => z.object({ data: item });

export function isDigits(value: string, length: number): boolean {
  return value.length === length && Array.from(value).every((char) => char >= '0' && char <= '9');
}

export function hasForbiddenCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 32 || code === 127 || char === '<' || char === '>';
  });
}
