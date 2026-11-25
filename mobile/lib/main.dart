import 'package:flutter/widgets.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/services/app_logger.dart';
import 'core/utils/formatters.dart';
import 'core/widgets/config_error_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final logsEnabled = AppConfig.current.logsEnabled();
  if (!logsEnabled) {
    debugPrint = (message, {wrapWidth}) {};
  }
  final logger = AppLogger(enabled: logsEnabled);
  logger.installGlobalHandlers();

  final problems = AppConfig.current.validate();
  if (problems.isNotEmpty) {
    for (final problem in problems) {
      logger.error('Configuration invalide : $problem');
    }
    runApp(ConfigErrorApp(problems: problems));
    return;
  }

  Intl.defaultLocale = Formatters.locale;
  await initializeDateFormatting(Formatters.locale);
  runApp(const App());
}
