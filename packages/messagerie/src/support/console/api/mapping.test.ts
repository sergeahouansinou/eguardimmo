import { describe, expect, it } from 'vitest';
import { consoleDetailOf, consoleMessageOf, emptyConsoleMessages } from '../../../../test/console';
import { OTHER_OPERATOR_ID, noteMessageFixture, replyMessageFixture, requesterMessageFixture } from '../testing';
import { withFresh, withMessages, withMeta } from './mapping';

const FIRST = requesterMessageFixture();
const SECOND = replyMessageFixture();
const NOTE = noteMessageFixture();

describe('fusion du détail de demande', () => {
  it('ajoute seulement les messages inconnus et recalcule le total', () => {
    const detail = consoleDetailOf({}, [FIRST, SECOND]);
    const merged = withMessages(detail, [consoleMessageOf(SECOND), consoleMessageOf(NOTE)]);
    expect(merged.messages.map((message) => message.id)).toEqual([FIRST.id, SECOND.id, NOTE.id]);
    expect(merged.messageCount).toBe(detail.messageCount + 1);
    expect(withMessages(detail, [consoleMessageOf(FIRST)])).toBe(detail);
  });

  it('garde les messages courants et prend le reste du serveur', () => {
    const current = consoleDetailOf({}, [FIRST, SECOND, NOTE]);
    const fresh = consoleDetailOf({ priority: 'high', assignee: { id: OTHER_OPERATOR_ID, name: 'Hugo Bernard' } }, [FIRST]);
    const merged = withFresh(current, fresh);
    expect(merged.messages).toHaveLength(3);
    expect(merged).toMatchObject({ priority: 'high', assignee: { id: OTHER_OPERATOR_ID } });
    expect(merged.messageCount).toBe(3);
  });

  it('retient le total du serveur quand il dépasse les messages connus', () => {
    const current = consoleDetailOf({}, [FIRST]);
    const fresh = { ...consoleDetailOf({}, [FIRST]), messageCount: 7 };
    expect(withFresh(current, fresh).messageCount).toBe(7);
    expect(withFresh(undefined, fresh)).toBe(fresh);
  });

  it('reporte statut et accusés de lecture de la page de messages', () => {
    const detail = consoleDetailOf({}, [FIRST]);
    const merged = withMeta(detail, { ...emptyConsoleMessages, status: 'waiting', requesterLastReadAt: '2026-11-19T11:00:00+00:00', supportLastReadAt: '2026-11-19T12:00:00+00:00' });
    expect(merged).toMatchObject({ status: 'waiting', requesterLastReadAt: '2026-11-19T11:00:00+00:00', supportLastReadAt: '2026-11-19T12:00:00+00:00' });
  });
});
