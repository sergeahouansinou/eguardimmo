import cancelled from './releves/tenant_detail_cancelled.json';
import confirmed from './releves/tenant_detail_confirmed.json';
import declined from './releves/tenant_detail_declined.json';
import done from './releves/tenant_detail_done.json';
import open from './releves/tenant_detail_open.json';
import proposed from './releves/tenant_detail_proposed.json';
import rescheduleRequested from './releves/tenant_detail_reschedule_requested.json';
import commentResponse from './releves/tenant_comment_created.json';
import fileResponse from './releves/tenant_file_uploaded.json';
import list from './releves/tenant_list.json';
import listEmpty from './releves/tenant_list_empty.json';
import listPage1 from './releves/tenant_list_page1.json';
import options from './releves/tenant_options.json';
import optionsTwoLeases from './releves/tenant_options_two_leases.json';
import cancelConflict from './releves/tenant_cancel_conflict.json';
import notFound from './releves/tenant_not_found.json';
import tooManyOpen from './releves/tenant_too_many_open.json';
import visitConflict from './releves/tenant_visit_confirm_conflict.json';

export const interventionsPage = list.body;
export const interventionsPage1 = listPage1.body;
export const interventionsPage2 = { ...list.body, data: list.body.data.slice(2) };
export const interventionsEmpty = listEmpty.body;

export const openDetail = open.body;
export const proposedDetail = proposed.body;
export const rescheduleRequestedDetail = rescheduleRequested.body;
export const confirmedDetail = confirmed.body;
export const doneDetail = done.body;
export const declinedDetail = declined.body;
export const cancelledDetail = cancelled.body;

export const fileUploaded = fileResponse.body;
export const commentCreated = commentResponse.body;

export const reportOptions = options.body;
export const reportOptionsTwoLeases = optionsTwoLeases.body;

export const notFoundProblem = notFound.body;
export const tooManyOpenProblem = tooManyOpen.body;
export const staleTransitionProblem = cancelConflict.body;
export const staleVisitProblem = visitConflict.body;

const lease = reportOptions.data[0];
const requested = rescheduleRequestedDetail.data.visits[0];

export const INTERVENTION_IDS = {
  lease: lease?.lease_id ?? '',
  open: openDetail.data.id,
  latest: interventionsPage.data[0]?.id ?? '',
  declined: declinedDetail.data.id,
  cancelled: cancelledDetail.data.id,
  visit: requested?.id ?? '',
  photo: openDetail.data.files[0]?.id ?? '',
  teamPhoto: openDetail.data.files[1]?.id ?? '',
  nature: lease?.natures[0]?.id ?? '',
  unit: lease?.units[0]?.id ?? '',
};
