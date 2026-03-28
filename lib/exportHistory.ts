import { Share } from 'react-native';
import { FastingSession } from '../types';
import { getCurrentPhase } from '../constants/phases';

/**
 * Generates a CSV string from fasting sessions and opens the native share sheet.
 */
export async function exportHistoryCSV(sessions: FastingSession[]): Promise<void> {
  const header = 'Date,Protocol,Target Hours,Actual Hours,Completed,Phase Reached,Notes';

  const rows = sessions.map((s) => {
    const date = new Date(s.started_at).toLocaleDateString('en-US');
    const actualHours = s.ended_at
      ? ((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000).toFixed(1)
      : 'In progress';
    const phase = s.ended_at
      ? getCurrentPhase((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3600000).name
      : 'In progress';
    const notes = s.notes ? `"${s.notes.replace(/"/g, '""')}"` : '';

    return `${date},${s.protocol},${s.target_hours},${actualHours},${s.completed},${phase},${notes}`;
  });

  const csv = [header, ...rows].join('\n');

  await Share.share({
    message: csv,
    title: 'FastAI History Export',
  });
}
