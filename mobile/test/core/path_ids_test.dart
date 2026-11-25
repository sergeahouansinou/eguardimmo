import 'package:eguardimmo/core/utils/path_ids.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const valid = '0193d2a0-0000-7000-8000-000000000001';

  test('UUID bien formé : renvoyé tel quel', () {
    expect(PathIds.uuid(valid), valid);
    expect(PathIds.uuid(valid.toUpperCase()), valid.toUpperCase());
  });

  test('segment : identifiant opaque accepté, séparateurs refusés', () {
    expect(PathIds.segment('t1'), 't1');
    expect(PathIds.segment(valid), valid);
    for (final bad in [
      '',
      '..',
      'a/b',
      'a?b',
      'a#b',
      'a b',
      'a%2Fb',
      'a' * 65,
    ]) {
      expect(() => PathIds.segment(bad), throwsFormatException, reason: bad);
    }
  });

  for (final bad in [
    '',
    '..',
    '../admin',
    '$valid/../x',
    '$valid?x=1',
    '$valid#',
    '%2e%2e',
    ' $valid',
    '0193d2a0-0000-7000-8000-00000000000g',
    'o1',
  ]) {
    test('identifiant refusé : "$bad"', () {
      expect(() => PathIds.uuid(bad), throwsFormatException);
    });
  }
}
