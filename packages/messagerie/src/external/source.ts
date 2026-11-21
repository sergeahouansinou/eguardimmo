import type {
  ComposeOption,
  MarkInput,
  MessagesPage,
  MessagesQuery,
  OpenInput,
  PostInput,
  ThreadAttachment,
  ThreadDetail,
  ThreadListQuery,
  ThreadMessage,
  ThreadPage,
} from './model';

export interface ExternalMessagerieSource {
  listThreads: (query: ThreadListQuery, cursor: string | null) => Promise<ThreadPage>;
  getThread: (id: string) => Promise<ThreadDetail>;
  listMessages: (id: string, query: MessagesQuery) => Promise<MessagesPage>;
  unreadCount: () => Promise<number>;
  composeOptions: () => Promise<ComposeOption[]>;
  openThread: (input: OpenInput) => Promise<ThreadDetail>;
  postMessage: (id: string, input: PostInput) => Promise<ThreadMessage>;
  markThread: (id: string, input: MarkInput) => Promise<void>;
  redactMessage: (id: string, messageId: string) => Promise<ThreadMessage>;
  downloadAttachment: (attachment: Pick<ThreadAttachment, 'id' | 'name'>) => Promise<void>;
}
