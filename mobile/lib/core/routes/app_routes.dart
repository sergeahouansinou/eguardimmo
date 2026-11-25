abstract final class AppRoutes() {
  static const explore = '/explorer';
  static const stays = '/sejours';
  static const messages = '/messages';
  static const account = '/compte';
  static const login = '/connexion';

  static const listingPattern = '/annonces/:ref';
  static const profilePattern = '/profil/:kind';

  static const conversationPattern = '/messages/conversations/:id';
  static const newConversation = '/messages/conversations/nouvelle';
  static const support = '/messages/support';
  static const newSupportTicket = '/messages/support/nouvelle';
  static const supportTicketPattern = '/messages/support/:id';

  static String conversation(String id) => '/messages/conversations/$id';
  static String supportTicket(String id) => '/messages/support/$id';

  static String listing(String ref) => '/annonces/$ref';
  static String profile(String kind) => '/profil/$kind';
}
