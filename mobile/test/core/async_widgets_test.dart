import 'package:eguardimmo/core/services/api_exception.dart';
import 'package:eguardimmo/core/state/async_view_model.dart';
import 'package:eguardimmo/core/state/load_state.dart';
import 'package:eguardimmo/core/theme/app_theme.dart';
import 'package:eguardimmo/core/widgets/async_body.dart';
import 'package:eguardimmo/core/widgets/async_section.dart';
import 'package:eguardimmo/core/widgets/async_sliver_body.dart';
import 'package:eguardimmo/core/widgets/inline_message.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget child) => MaterialApp(
  theme: AppTheme.light(),
  home: Scaffold(body: child),
);

Widget _data(BuildContext context, String data) =>
    ListView(children: [Text('données $data')]);

const _staleFailure = Failed<String>('Panne serveur', previous: 'A');

class _ViewModel(var Future<String> Function() action)
    extends AsyncViewModel<String> {
  @override
  Future<String> fetch() => action();
}

void main() {
  group('AsyncBody', () {
    testWidgets(
      'échec avec données conservées : bandeau au-dessus des données',
      (tester) async {
        var retries = 0;
        await tester.pumpWidget(
          _app(
            AsyncBody<String>(
              state: _staleFailure,
              onRetry: () => retries++,
              builder: _data,
            ),
          ),
        );
        expect(find.text('données A'), findsOneWidget);
        expect(find.byType(InlineMessage), findsOneWidget);
        expect(find.text('Panne serveur'), findsOneWidget);
        expect(
          tester.getBottomLeft(find.byType(InlineMessage)).dy,
          lessThanOrEqualTo(tester.getTopLeft(find.text('données A')).dy),
        );
        await tester.tap(find.text('Réessayer'));
        expect(retries, 1);
      },
    );

    testWidgets('chargement avec données conservées : aucun bandeau', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          AsyncBody<String>(
            state: const Loading<String>(previous: 'A'),
            onRetry: () {},
            builder: _data,
          ),
        ),
      );
      expect(find.text('données A'), findsOneWidget);
      expect(find.byType(InlineMessage), findsNothing);
    });

    testWidgets('échec sans donnée : message plein cadre, pas de bandeau', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          AsyncBody<String>(
            state: const Failed<String>('Panne serveur'),
            onRetry: () {},
            builder: _data,
          ),
        ),
      );
      expect(find.text('Panne serveur'), findsOneWidget);
      expect(find.byType(InlineMessage), findsNothing);
    });

    for (final status in [403, 404]) {
      testWidgets('$status après un chargement : plus aucune ancienne donnée', (
        tester,
      ) async {
        final viewModel = _ViewModel(() async => 'A');
        await viewModel.load();
        viewModel.action = () async =>
            throw ApiException(statusCode: status, message: 'Accès retiré');
        await viewModel.load();
        await tester.pumpWidget(
          _app(
            AsyncBody<String>(
              state: viewModel.state,
              onRetry: () {},
              builder: _data,
            ),
          ),
        );
        expect(find.text('données A'), findsNothing);
        expect(find.text('Accès retiré'), findsOneWidget);
      });
    }

    testWidgets(
      'sans hauteur bornée : le bandeau ne casse pas la mise en page',
      (tester) async {
        await tester.pumpWidget(
          _app(
            SingleChildScrollView(
              child: AsyncBody<String>(
                state: _staleFailure,
                onRetry: () {},
                builder: (_, data) => Text('données $data'),
              ),
            ),
          ),
        );
        expect(tester.takeException(), isNull);
        expect(find.text('Panne serveur'), findsOneWidget);
        expect(find.text('données A'), findsOneWidget);
      },
    );
  });

  group('AsyncSection', () {
    testWidgets('échec avec données conservées : bandeau et données', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          AsyncSection<String>(
            title: 'Loyers',
            state: _staleFailure,
            onRetry: () {},
            builder: (_, data) => Text('données $data'),
          ),
        ),
      );
      expect(find.text('données A'), findsOneWidget);
      expect(find.byType(InlineMessage), findsOneWidget);
      expect(find.text('Panne serveur'), findsOneWidget);
    });
  });

  group('AsyncSliverBody', () {
    testWidgets('échec avec données conservées : bandeau et données', (
      tester,
    ) async {
      await tester.pumpWidget(
        _app(
          CustomScrollView(
            slivers: [
              AsyncSliverBody<String>(
                state: _staleFailure,
                onRetry: () {},
                builder: (_, data) =>
                    SliverToBoxAdapter(child: Text('données $data')),
              ),
            ],
          ),
        ),
      );
      expect(find.text('données A'), findsOneWidget);
      expect(find.byType(InlineMessage), findsOneWidget);
      expect(find.text('Panne serveur'), findsOneWidget);
    });
  });
}
