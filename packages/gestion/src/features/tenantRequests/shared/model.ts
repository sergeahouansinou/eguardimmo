export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorQuery {
  cursor: string | null;
}
