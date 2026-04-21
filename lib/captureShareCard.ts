import { RefObject } from 'react';
import { View, Share } from 'react-native';
import * as Haptics from 'expo-haptics';
import { captureRef } from 'react-native-view-shot';
import { FastingSession } from '../types';
import { trackShareSession } from './posthog';

interface CaptureAndShareArgs {
  ref: RefObject<View | null>;
  session: FastingSession;
  source: 'history' | 'fast_complete';
}

/**
 * Capture the referenced ShareCard view as a PNG, then open the iOS share sheet.
 * Fires PostHog `share_session` and a success haptic only when the user actually
 * shares (not when the sheet is dismissed).
 */
export async function captureAndShare({ ref, session, source }: CaptureAndShareArgs): Promise<void> {
  if (!ref.current) {
    console.warn('[captureShareCard] missing ref');
    return;
  }

  const uri = await captureRef(ref.current, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  try {
    const result = await Share.share({ url: uri });
    if (result.action !== Share.sharedAction) return;

    const endMs = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
    const durationH = (endMs - new Date(session.started_at).getTime()) / 3600000;

    trackShareSession({
      source,
      protocol: session.protocol,
      completed: !!session.completed,
      duration_h: Math.round(durationH * 100) / 100,
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (err) {
    console.warn('[captureShareCard] share failed:', err);
  }
}
