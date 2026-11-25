import 'package:eguardimmo/core/utils/json_reader.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'un type inattendu lève une FormatException, sans valeur par défaut',
    () {
      expect(() => Json.string({'a': 1}, 'a'), throwsFormatException);
      expect(() => Json.integer({'a': '1'}, 'a'), throwsFormatException);
      expect(() => Json.boolean({'a': 'true'}, 'a'), throwsFormatException);
      expect(() => Json.string(const {}, 'a'), throwsFormatException);
      expect(
        () => Json.data(const {'data': <Object?>[]}, 'x'),
        throwsFormatException,
      );
      expect(
        () => Json.dataList(const {'data': <String, Object?>{}}, 'x'),
        throwsFormatException,
      );
    },
  );

  test('les valeurs nullables acceptent null et refusent un autre type', () {
    expect(Json.stringOrNull({'a': null}, 'a'), isNull);
    expect(Json.integerOrNull({'a': 4.0}, 'a'), 4);
    expect(() => Json.integerOrNull({'a': 4.5}, 'a'), throwsFormatException);
    expect(() => Json.stringOrNull({'a': 2}, 'a'), throwsFormatException);
  });

  test('une date invalide est refusée', () {
    expect(() => Json.date({'d': 'demain'}, 'd'), throwsFormatException);
    expect(Json.dateOrNull({'d': null}, 'd'), isNull);
  });
}
