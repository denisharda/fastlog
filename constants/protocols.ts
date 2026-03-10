import { FastingProtocol } from '../types';

export interface ProtocolConfig {
  id: FastingProtocol;
  label: string;
  fastHours: number;
  eatHours: number;
  description: string;
  popular?: boolean;
}

export const PROTOCOLS: Record<FastingProtocol, ProtocolConfig> = {
  '16:8': {
    id: '16:8',
    label: '16:8',
    fastHours: 16,
    eatHours: 8,
    description: '16h fast, 8h eating window',
    popular: true,
  },
  '18:6': {
    id: '18:6',
    label: '18:6',
    fastHours: 18,
    eatHours: 6,
    description: '18h fast, 6h eating window',
  },
  '24h': {
    id: '24h',
    label: '24h',
    fastHours: 24,
    eatHours: 0,
    description: 'Full day fast (OMAD)',
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    fastHours: 0,
    eatHours: 0,
    description: 'Set your own target (8–72h)',
  },
};

export const PROTOCOL_LIST: ProtocolConfig[] = Object.values(PROTOCOLS);

export const DEFAULT_PROTOCOL: FastingProtocol = '16:8';

/** Minimum and maximum hours for the custom protocol */
export const CUSTOM_PROTOCOL_MIN_HOURS = 8;
export const CUSTOM_PROTOCOL_MAX_HOURS = 72;
