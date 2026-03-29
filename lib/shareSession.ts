import { Share } from 'react-native';
import { FastingSession } from '../types';
import { getCurrentPhase } from '../constants/phases';

/**
 * Formats a fasting session as a shareable text summary and opens the native share sheet.
 */
export async function shareSession(session: FastingSession, waterMl?: number): Promise<void> {
  const startDate = new Date(session.started_at);
  const dateStr = startDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let duration = '';
  let phaseStr = '';

  if (session.ended_at) {
    const ms = new Date(session.ended_at).getTime() - startDate.getTime();
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    duration = `${hours}h ${minutes}m`;
    const elapsedHours = ms / 3600000;
    const phase = getCurrentPhase(elapsedHours);
    phaseStr = phase.name;
  } else {
    duration = 'In progress';
    const elapsed = (Date.now() - startDate.getTime()) / 3600000;
    const phase = getCurrentPhase(elapsed);
    phaseStr = phase.name;
  }

  const lines = [
    `FastBuddy — ${session.protocol} Fast ${session.completed ? 'Complete!' : 'Done'}`,
    `Duration: ${duration}`,
    `Phase: ${phaseStr}`,
  ];

  if (waterMl && waterMl > 0) {
    lines.push(`Water: ${waterMl.toLocaleString()}ml`);
  }

  lines.push(`${dateStr}`);

  await Share.share({
    message: lines.join('\n'),
  });
}
