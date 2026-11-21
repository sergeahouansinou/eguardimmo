import type { ThreadAttachment } from '../model';
import type {
  Assignee,
  RestrictInput,
  StaffListQuery,
  StaffMarkInput,
  StaffMessage,
  StaffMessagesPage,
  StaffMessagesQuery,
  StaffOpenInput,
  StaffPostInput,
  StaffThreadDetail,
  StaffThreadPage,
  StaffUnread,
  StaffUpdateInput,
} from './model';

export interface StaffMessagerieSource {
  listThreads: (query: StaffListQuery, cursor: string | null) => Promise<StaffThreadPage>;
  getThread: (id: string) => Promise<StaffThreadDetail>;
  listMessages: (id: string, query: StaffMessagesQuery) => Promise<StaffMessagesPage>;
  unread: () => Promise<StaffUnread>;
  openThread: (input: StaffOpenInput) => Promise<StaffThreadDetail>;
  postMessage: (id: string, input: StaffPostInput) => Promise<StaffMessage>;
  markThread: (id: string, input: StaffMarkInput) => Promise<void>;
  updateThread: (id: string, input: StaffUpdateInput) => Promise<StaffThreadDetail>;
  redactMessage: (id: string, messageId: string, reason: string | null) => Promise<StaffMessage>;
  restrict: (id: string, input: RestrictInput) => Promise<StaffThreadDetail>;
  lift: (id: string) => Promise<StaffThreadDetail>;
  assignees: () => Promise<Assignee[]>;
  downloadAttachment: (attachment: Pick<ThreadAttachment, 'id' | 'name'>) => Promise<void>;
}
