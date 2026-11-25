abstract final class RouteName() {
  static const explore = '/explorer';
  static const stays = '/sejours';
  static const messages = '/messages';
  static const account = '/compte';
  static const login = '/connexion';
  static const listing = '/annonces/detail';

  static const tenantHome = '/profil/locataire';
  static const tenantRent = '$tenantHome/loyers';
  static const tenantInstallment = '$tenantRent/detail';
  static const tenantRequests = '$tenantHome/demandes';
  static const tenantNewRequest = '$tenantRequests/nouvelle';
  static const tenantRequest = '$tenantRequests/detail';
  static const tenantDocuments = '$tenantHome/documents';

  static const ownerHome = '/profil/proprietaire';
  static const ownerPayouts = '$ownerHome/reversements';
  static const ownerStatement = '$ownerHome/releve';
  static const ownerProperties = '$ownerHome/biens';
  static const ownerDocuments = '$ownerHome/documents';

  static const agencyHome = '/profil/agence';
  static const agencyUnpaid = '$agencyHome/impayes';
  static const agencyInterventions = '$agencyHome/interventions';
  static const agencyIntervention = '$agencyInterventions/detail';
  static const agencyPortfolio = '$agencyHome/portefeuille';

  static const newConversation = '$messages/conversations/nouvelle';
  static const conversation = '$messages/conversations/detail';
  static const support = '$messages/support';
  static const newSupportTicket = '$support/nouvelle';
  static const supportTicket = '$support/detail';
}
