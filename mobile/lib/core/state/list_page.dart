class const ListPage<T>({
  required final List<T> items,
  required final String? nextCursor,
}) {
  bool get hasMore => nextCursor != null;
}
