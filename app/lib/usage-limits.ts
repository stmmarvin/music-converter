import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';

export type UsagePlan = 'free' | 'premium';

type UsageRecord = {
  day: string;
  month: string;
  videoDownloads: number;
  musicDownloads: number;
  premiumMusicDownloads: number;
};

const usage = new Map<string, UsageRecord>();

export const LIMITS = {
  free: {
    videoPerDay: 3,
    musicPerDay: 20,
    maxVideoQuality: 720,
    maxMp3Quality: 192,
  },
  premium: {
    videoPerDay: 20,
    premiumMusicPerMonth: 100,
    maxVideoQuality: 2160,
    maxMp3Quality: 320,
  },
} as const;

function dateParts() {
  const now = new Date();
  return {
    day: now.toISOString().slice(0, 10),
    month: now.toISOString().slice(0, 7),
  };
}

export function getUsageIdentity(request: NextRequest) {
  return request.cookies.get('mc-device-id')?.value || randomUUID();
}

export function getPlan(request: NextRequest): UsagePlan {
  const premiumToken = process.env.MEDIA_CONVERTER_PREMIUM_TOKEN;
  return premiumToken && request.cookies.get('mc-premium-token')?.value === premiumToken
    ? 'premium'
    : 'free';
}

export function consumeDownload(identity: string, plan: UsagePlan, mediaType: 'audio' | 'video', quality: number, isPremiumMusic: boolean) {
  const { day, month } = dateParts();
  const previous = usage.get(identity);
  const record: UsageRecord = previous?.day === day && previous.month === month
    ? previous
    : { day, month, videoDownloads: 0, musicDownloads: 0, premiumMusicDownloads: 0 };
  const limits = LIMITS[plan];

  if (mediaType === 'video' && (quality > limits.maxVideoQuality || record.videoDownloads >= limits.videoPerDay)) {
    return {
      allowed: false as const,
      error: plan === 'free'
        ? 'Free users can download up to 3 videos per day and up to 720p. Upgrade to Premium for up to 20 daily videos and 4K quality.'
        : 'Your Premium video limit of 20 downloads per day has been reached.',
    };
  }

  if (mediaType === 'audio' && plan === 'free' && (quality > limits.maxMp3Quality || record.musicDownloads >= LIMITS.free.musicPerDay)) {
    return {
      allowed: false as const,
      error: 'Free users can download up to 20 standard music files per day. Premium unlocks high-quality audio and 100 premium music downloads per month.',
    };
  }

  if (
    mediaType === 'audio' &&
    plan === 'premium' &&
    isPremiumMusic &&
    record.premiumMusicDownloads >= LIMITS.premium.premiumMusicPerMonth
  ) {
    return {
      allowed: false as const,
      error: 'Your Premium high-quality music limit of 100 downloads per month has been reached.',
    };
  }

  if (mediaType === 'video') {
    record.videoDownloads += 1;
  } else {
    record.musicDownloads += 1;
    if (isPremiumMusic) record.premiumMusicDownloads += 1;
  }
  usage.set(identity, record);
  return { allowed: true as const };
}
