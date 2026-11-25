/// Chemins de l'espace locataire (sous /profil/locataire).
abstract final class TenantPaths() {
  static const home = '/profil/locataire';
  static const rent = '$home/loyers';
  static const requests = '$home/demandes';
  static const newRequest = '$requests/nouvelle';
  static const documents = '$home/documents';

  static String installment(String id) => '$rent/$id';
  static String request(String id) => '$requests/$id';
}
