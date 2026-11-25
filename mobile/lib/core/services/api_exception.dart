class const ApiException({
  required final int? statusCode,
  required final String message,
  final String? code,
  final Map<String, List<String>> fieldErrors = const {},
  final int? retryAfterSeconds,
  final bool cancelled = false,
}) implements Exception {
  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isConflict => statusCode == 409;
  bool get isValidation => statusCode == 422;
  bool get isRateLimited => statusCode == 429;
  bool get isNetwork => statusCode == null && !cancelled;

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}
