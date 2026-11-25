sealed class const LoadState<T>() {
  T? get dataOrNull => switch (this) {
    Loaded<T>(:final data) => data,
    Loading<T>(:final previous) => previous,
    Failed<T>(:final previous) => previous,
    Idle<T>() => null,
  };

  bool get isLoading => this is Loading<T>;
}

final class const Idle<T>() extends LoadState<T>;

final class const Loading<T>({final T? previous}) extends LoadState<T> {}

final class const Loaded<T>(final T data) extends LoadState<T> {}

final class const Failed<T>(final String message, {final T? previous})
    extends LoadState<T> {}
