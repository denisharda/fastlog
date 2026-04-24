import { assertEquals } from 'std/assert/mod.ts';
import { classify } from './index.ts';

Deno.test('classify: ok', () => {
  assertEquals(classify({ status: 'ok' }), 'ok');
});

Deno.test('classify: DeviceNotRegistered → device_not_registered', () => {
  assertEquals(
    classify({ status: 'error', details: { error: 'DeviceNotRegistered' } }),
    'device_not_registered',
  );
});

Deno.test('classify: other error', () => {
  assertEquals(
    classify({ status: 'error', details: { error: 'MessageRateExceeded' } }),
    'other_error',
  );
});

Deno.test('classify: missing → pending', () => {
  assertEquals(classify(undefined), 'pending');
});
