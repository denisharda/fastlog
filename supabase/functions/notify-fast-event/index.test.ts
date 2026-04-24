import { assertEquals } from 'std/assert/mod.ts';
import { buildExpoMessages, shouldNotify } from './index.ts';

Deno.test('shouldNotify: ignores non-INSERT events', () => {
  const payload = {
    type: 'UPDATE' as const,
    record: { last_modified_by_device: 'a' } as any,
  };
  assertEquals(shouldNotify(payload as any), false);
});

Deno.test('shouldNotify: passes INSERT events', () => {
  const payload = {
    type: 'INSERT' as const,
    record: { last_modified_by_device: 'a' } as any,
  };
  assertEquals(shouldNotify(payload as any), true);
});

Deno.test('shouldNotify: skips INSERT that already has ended_at', () => {
  const payload = {
    type: 'INSERT' as const,
    record: { last_modified_by_device: 'a', ended_at: '2026-04-24T00:00:00Z' } as any,
  };
  assertEquals(shouldNotify(payload as any), false);
});

Deno.test('buildExpoMessages: excludes originating device', () => {
  const tokens = [
    { device_id: 'phone', push_token: 'ExponentPushToken[A]' },
    { device_id: 'tablet', push_token: 'ExponentPushToken[B]' },
  ];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: 'phone',
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages.length, 1);
  assertEquals(messages[0].to, 'ExponentPushToken[B]');
});

Deno.test('buildExpoMessages: sends to all when origin device is missing', () => {
  const tokens = [
    { device_id: 'phone', push_token: 'ExponentPushToken[A]' },
    { device_id: 'tablet', push_token: 'ExponentPushToken[B]' },
  ];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: 'unknown-device',
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages.length, 2);
});

Deno.test('buildExpoMessages: handles null originDeviceId by sending to all', () => {
  const tokens = [{ device_id: 'phone', push_token: 'ExponentPushToken[A]' }];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: null,
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages.length, 1);
});

Deno.test('buildExpoMessages: title and body match brand voice', () => {
  const tokens = [{ device_id: 'tablet', push_token: 'ExponentPushToken[B]' }];
  const messages = buildExpoMessages(tokens, {
    originDeviceId: 'phone',
    protocol: '16:8',
    sessionId: 'sess-1',
  });
  assertEquals(messages[0].title, 'Fast started');
  assertEquals(messages[0].body, 'Your 16:8 fast is running on another device.');
  assertEquals((messages[0].data as any).sessionId, 'sess-1');
});
