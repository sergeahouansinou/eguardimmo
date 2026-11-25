abstract final class AgencyPaths() {
  static const home = '/profil/agence';
  static const unpaid = '$home/impayes';
  static const interventions = '$home/interventions';
  static const portfolio = '$home/portefeuille';

  static String intervention(String id) =>
      '$interventions/${Uri.encodeComponent(id)}';
}
