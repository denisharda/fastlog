// supabase/functions/dispatch-scheduled-pushes/index_test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildMessagesForRow } from './index.ts';

Deno.test('buildMessagesForRow builds one message per device token', () => {
  const tokens = [
    { push_token: 'ExpoPushToken[a]', device_id: 'd1' },
    { push_token: 'ExpoPushToken[b]', device_id: 'd2' },
  ];
  const row = {
    id: '11111111-1111-1111-1111-111111111111',
    user_id: 'u1',
    session_id: 's1',
    kind: 'halfway',
    fire_at: new Date().toISOString(),
    payload: { title: 'Halfway there', body: 'You\'re at the midpoint.', sessionId: 's1' },
  };
  const msgs = buildMessagesForRow(row, tokens);
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0].title, 'Halfway there');
  assertEquals(msgs[0].body, 'You\'re at the midpoint.');
  assertEquals(msgs[0].sound, 'default');
  assertEquals(msgs[0].data.kind, 'halfway');
  assertEquals(msgs[0].data.sessionId, 's1');
});

Deno.test('buildMessagesForRow returns empty when no tokens', () => {
  const row = {
    id: '1', user_id: 'u1', session_id: 's1',
    kind: 'complete', fire_at: new Date().toISOString(),
    payload: { title: 'x', body: 'y', sessionId: 's1' },
  };
  assertEquals(buildMessagesForRow(row, []).length, 0);
});
