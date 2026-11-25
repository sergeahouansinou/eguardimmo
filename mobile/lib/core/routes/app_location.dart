import 'package:flutter/widgets.dart';

/// Une destination : nom de route et argument typé.
class const AppLocation(final String name, [final Object? arguments]) {
  RouteSettings get settings => RouteSettings(name: name, arguments: arguments);

  @override
  bool operator ==(Object other) =>
      other is AppLocation &&
      other.name == name &&
      other.arguments == arguments;

  @override
  int get hashCode => Object.hash(name, arguments);

  @override
  String toString() =>
      arguments == null ? name : '$name ${arguments.toString()}';
}
