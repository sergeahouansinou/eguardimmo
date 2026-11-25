import 'package:eguardimmo/features/messages/models/messaging_scope.dart';
import 'package:eguardimmo/features/profiles/models/profile_space.dart';
import 'package:eguardimmo/features/support/models/ticket_message.dart';
import 'package:eguardimmo/features/support/services/support_service.dart';
import 'package:eguardimmo/features/tenant/services/tenant_leases_service.dart';
import 'package:eguardimmo/features/tenant/services/tenant_maintenance_service.dart';
import 'package:eguardimmo/features/tenant/services/tenant_rent_service.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fakes.dart';

const _hostile = '../admin';

void main() {
  late FakeApiClient api;

  setUp(() => api = FakeApiClient((_) => fail('aucun appel attendu')));

  Future<void> refused(Future<Object?> Function() call) async {
    await expectLater(Future<Object?>.sync(call), throwsFormatException);
    expect(api.calls, isEmpty);
  }

  test('maintenance locataire : identifiant hostile, aucune requête', () async {
    final service = TenantMaintenanceService(api);
    await refused(() => service.show(_hostile));
    await refused(() => service.cancel(_hostile));
    await refused(
      () => service.comment(_hostile, 'texte', idempotencyKey: 'k'),
    );
  });

  test('échéance de loyer : identifiant hostile, aucune requête', () async {
    await refused(() => TenantRentService(api).installment(_hostile));
  });

  test('documents du bail : identifiant hostile, aucune requête', () async {
    await refused(() => TenantLeasesService(api).documents(_hostile));
  });

  test('support : identifiants de demande et de pièce jointe', () async {
    final service = SupportService(api);
    await refused(() => service.ticket(_hostile));
    await refused(() => service.messages(_hostile, after: 'x'));
    await refused(() => service.reply(_hostile, body: 'a', clientId: 'b'));
    await refused(() => service.markRead(_hostile));
    await refused(
      () => service.downloadAttachment(
        const TicketAttachment(
          id: _hostile,
          name: 'a',
          mimeType: 'image/png',
          sizeBytes: 1,
        ),
      ),
    );
  });

  test('messagerie : fil, messages, pièce jointe et organisation', () {
    const tenant = MessagingScope(space: SpaceKind.tenant);
    final endpoint = ThreadsEndpoint(tenant);
    expect(() => endpoint.conversation(_hostile), throwsFormatException);
    expect(() => endpoint.messages(_hostile), throwsFormatException);
    expect(() => endpoint.attachment(_hostile), throwsFormatException);
    expect(
      () => ThreadsEndpoint(
        const MessagingScope(
          space: SpaceKind.organization,
          organizationId: _hostile,
        ),
      ).conversations,
      throwsFormatException,
    );
  });

  test('identifiants bien formés : chemins inchangés', () {
    const id = '0193d2a0-0000-7000-8000-000000000001';
    final endpoint = ThreadsEndpoint(
      const MessagingScope(space: SpaceKind.tenant),
    );
    expect(endpoint.conversation(id), '/tenant/conversations/$id');
    expect(endpoint.attachment(id), '/tenant/conversation-attachments/$id');
  });
}
