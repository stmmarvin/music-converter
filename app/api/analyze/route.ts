import { NextRequest, NextResponse } from 'next/server';
import youtubedl from 'youtube-dl-exec';

const PLATFORM_HOSTS = {
  youtube: ['youtube.com', 'music.youtube.com', 'youtu.be'],
  spotify: ['spotify.com', 'open.spotify.com'],
  vimeo: ['vimeo.com'],
  soundcloud: ['soundcloud.com'],
  bandcamp: ['bandcamp.com'],
  tiktok: ['tiktok.com', 'vm.tiktok.com'],
  instagram: ['instagram.com', 'instagr.am'],
} as const;

function isPlatform(value: string): value is keyof typeof PLATFORM_HOSTS {
  return value in PLATFORM_HOSTS;
}

function matchesPlatform(url: string, platform: keyof typeof PLATFORM_HOSTS) {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return PLATFORM_HOSTS[platform].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function detectPlatform(url: string): keyof typeof PLATFORM_HOSTS | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return (Object.keys(PLATFORM_HOSTS) as Array<keyof typeof PLATFORM_HOSTS>).find((platform) =>
      PLATFORM_HOSTS[platform].some((host) => hostname === host || hostname.endsWith(`.${host}`)),
    ) || null;
  } catch {
    return null;
  }
}

async function getSpotifyPreview(url: string) {
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!match || !clientId || !clientSecret) {
    throw new Error('Spotify API credentials are not configured');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to authenticate with Spotify');
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  const trackResponse = await fetch(`https://api.spotify.com/v1/tracks/${match[1]}?market=US`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!trackResponse.ok) {
    throw new Error('The requested Spotify track was not found');
  }

  const track = (await trackResponse.json()) as {
    name?: string;
    duration_ms?: number;
    artists?: Array<{ name?: string }>;
    album?: { images?: Array<{ url?: string }> };
  };

  return {
    title: `${track.artists?.map((artist) => artist.name).filter(Boolean).join(', ') || 'Unknown artist'} - ${track.name || 'Untitled'}`,
    duration: Math.round((track.duration_ms || 0) / 1000),
    thumbnail: track.album?.images?.[0]?.url || null,
  };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')?.trim();
  const requestedPlatform = request.nextUrl.searchParams.get('platform');

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  const platform = requestedPlatform ? (isPlatform(requestedPlatform) ? requestedPlatform : null) : detectPlatform(url);
  if (!platform) {
    return NextResponse.json({ error: 'Unsupported source platform. Please enter a supported media URL.' }, { status: 422 });
  }

  try {
    if (!matchesPlatform(url, platform)) {
      return NextResponse.json({ error: `The URL does not belong to ${platform}` }, { status: 422 });
    }

    if (platform === 'spotify') {
      return NextResponse.json({ platform, ...(await getSpotifyPreview(url)) });
    }

    const data = (await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
    })) as {
      title?: string;
      duration?: number;
      thumbnail?: string;
      uploader?: string;
      webpage_url?: string;
    };

    return NextResponse.json({
      platform,
      title: data.title || 'Untitled media',
      duration: Math.round(data.duration || 0),
      thumbnail: data.thumbnail || null,
      uploader: data.uploader || null,
      webpageUrl: data.webpage_url || url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to analyze this URL';
    const userMessage = /drm protected/i.test(message)
      ? `${platform} has marked this item as DRM-protected and does not provide a downloadable public stream.`
      : message;
    console.error('Media analysis error:', error);
    return NextResponse.json({ error: userMessage }, { status: 422 });
  }
}
