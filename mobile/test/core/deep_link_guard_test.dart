import 'package:eguardimmo/core/routes/deep_link_guard.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('liens acceptés', () {
    for (final path in [
      '/explorer',
      '/sejours',
      '/messages',
      '/compte',
      '/connexion',
      '/annonces/k3m7q9x2v8nb',
      '/profil/locataire',
      '/profil/proprietaire',
      '/profil/agence',
      '/profil/locataire/loyers',
      '/profil/locataire/loyers/01a1e955-004b-709d-9353-b6f2e30e1028',
      '/profil/locataire/demandes/nouvelle',
      '/profil/locataire/demandes/01a1e955-004b-709d-9353-b6f2e30e1028',
      '/profil/proprietaire/reversements',
      '/profil/proprietaire/releve',
      '/profil/proprietaire/biens',
      '/profil/proprietaire/documents',
      '/profil/agence/impayes',
      '/profil/agence/interventions',
      '/profil/agence/interventions/01a1ef81-509b-72a6-b78e-36d2c9ec12f1',
      '/profil/agence/portefeuille',
      '/messages/support',
      '/messages/support/nouvelle',
      '/messages/conversations/nouvelle',
      '/messages/conversations/01a1ef81-0000-7000-8000-000000000001',
      '/messages/support/01a1ef90-0000-7000-8000-000000000001',
    ]) {
      test(
        path,
        () => expect(DeepLinkGuard.isAllowed(Uri.parse(path)), isTrue),
      );
    }
  });

  group('liens refusés', () {
    for (final path in [
      '/',
      '/admin',
      '/console/accounts',
      '/annonces/trop-court',
      '/annonces/K3M7Q9X2V8NB',
      '/annonces/k3m7q9x2v8n0',
      '/annonces/k3m7q9x2v8nb/extra',
      '/annonces/../etc/passwd',
      '/annonces/Ab3dE6gH9jK<',
      '/profil/voyageur',
      '/profil/console',
      '/profil/locataire/admin',
      '/profil/agence/reversements',
      '/profil/proprietaire/impayes',
      '/profil/agence/impayes/../x',
      '/profil/agence/impayes/pas-un-identifiant',
      '/profil/locataire/loyers/01a1e955-004b-709d-9353-b6f2e30e1028/x',
      '/profil/locataire/loyers/nouvelle',
      '/profil/locataire/documents/01a1e955-004b-709d-9353-b6f2e30e1028',
      '/profil/locataire/documents/nouvelle',
      '/profil/proprietaire/documents/01a1e955-004b-709d-9353-b6f2e30e1028',
      '/profil/proprietaire/reversements/01a1e955-004b-709d-9353-b6f2e30e1028',
      '/profil/proprietaire/biens/nouvelle',
      '/profil/agence/impayes/01a1e955-004b-709d-9353-b6f2e30e1028',
      '/profil/agence/interventions/nouvelle',
      '/profil/agence/interventions/pas-un-identifiant',
      '/profil/agence/interventions/01a1ef81-509b-72a6-b78e-36d2c9ec12f1/x',
      '/connexion/../x',
      '/messages/inconnu',
      '/messages/support/pas-un-identifiant',
      '/messages/conversations/../x',
      '/messages/conversations/01a1ef81-0000-7000-8000-000000000001/x',
      '/messages/conversations/01A1EF81-0000-7000-8000-000000000001',
    ]) {
      test(
        path,
        () => expect(DeepLinkGuard.isAllowed(Uri.parse(path)), isFalse),
      );
    }
  });
}
