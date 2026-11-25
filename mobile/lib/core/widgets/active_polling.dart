import 'package:flutter/material.dart';

/// Signale quand l'écran est réellement visible : onglet affiché, aucun écran
/// par-dessus, application au premier plan. Les interrogations périodiques
/// s'arrêtent sinon et reprennent au retour.
class const ActivePolling({
  super.key,
  required final ValueChanged<bool> onActiveChanged,
  required final Widget child,
}) extends StatefulWidget {
  @override
  State<ActivePolling> createState() => _ActivePollingState();
}

class _ActivePollingState() extends State<ActivePolling> {
  late final AppLifecycleListener _lifecycle;
  bool _foreground = true;
  bool _visible = true;
  bool? _reported;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onStateChange: (state) {
        _foreground = state == AppLifecycleState.resumed;
        _report();
      },
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _visible = TickerMode.valuesOf(context).enabled;
    WidgetsBinding.instance.addPostFrameCallback((_) => _report());
  }

  void _report() {
    if (!mounted) return;
    final active = _foreground && _visible;
    if (active == _reported) return;
    _reported = active;
    widget.onActiveChanged(active);
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    if (_reported ?? false) widget.onActiveChanged(false);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
