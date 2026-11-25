import '../../helpers/api_fixtures.dart';
import '../../helpers/fakes.dart';

const threadId = '01a1ef81-0000-7000-8000-000000000001';

Object? tenantApi(RecordedCall call) {
  final path = call.path;
  if (path == '/tenant/conversations') {
    return apiFixture('messages/tenant_threads');
  }
  if (path == '/tenant/conversations/options') {
    return apiFixture('messages/tenant_options');
  }
  if (path == '/tenant/conversations/$threadId/messages') {
    return call.method == 'POST'
        ? apiFixture('messages/tenant_message_posted')
        : apiFixture('messages/tenant_messages_after_empty');
  }
  if (path == '/tenant/conversations/$threadId') {
    return apiFixture('messages/tenant_thread');
  }
  return null;
}
