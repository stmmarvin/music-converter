import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { createReadStream } from 'fs';
import { mkdtemp, rm, stat } from 'fs/promises';
import os from 'os';
import path from 'path';
import youtubedl from 'youtube-dl-exec';
import { Readable } from 'stream';
import { consumeDownload, getPlan, getUsageIdentity, LIMITS } from '@/app/lib/usage-limits';

const FORMAT_CONFIG = {
  mp3: { extension: 'mp3', contentType: 'audio/mpeg', mediaType: 'audio', audioCodec: 'libmp3lame', audioBitrate: '192k', outputFormat: 'mp3' },
  wav: { extension: 'wav', contentType: 'audio/wav', mediaType: 'audio', audioCodec: 'pcm_s16le', audioBitrate: undefined, outputFormat: 'wav' },
  m4a: { extension: 'm4a', contentType: 'audio/mp4', mediaType: 'audio', audioCodec: 'aac', audioBitrate: '192k', outputFormat: 'ipod' },
  flac: { extension: 'flac', contentType: 'audio/flac', mediaType: 'audio', audioCodec: 'flac', audioBitrate: undefined, outputFormat: 'flac' },
  mp4: { extension: 'mp4', contentType: 'video/mp4', mediaType: 'video', videoCodec: 'libx264', audioCodec: 'aac', audioBitrate: undefined, outputFormat: 'mp4' },
  mpeg: { extension: 'mpeg', contentType: 'video/mpeg', mediaType: 'video', videoCodec: 'mpeg2video', audioCodec: 'mp2', audioBitrate: undefined, outputFormat: 'mpeg' },
} as const;

type AudioFormat = keyof typeof FORMAT_CONFIG;

const MP3_QUALITIES = ['128', '192', '320'] as const;
type Mp3Quality = (typeof MP3_QUALITIES)[number];

const VIDEO_QUALITIES = ['360', '480', '720', '1080', '1440', '2160'] as const;
type VideoQuality = (typeof VIDEO_QUALITIES)[number];

const PLATFORM_HOSTS = {
  youtube: ['youtube.com', 'music.youtube.com', 'youtu.be'],
  spotify: ['spotify.com', 'open.spotify.com'],
  vimeo: ['vimeo.com'],
  soundcloud: ['soundcloud.com'],
  bandcamp: ['bandcamp.com'],
  tiktok: ['tiktok.com', 'vm.tiktok.com'],
  instagram: ['instagram.com', 'instagr.am'],
} as const;

type Platform = keyof typeof PLATFORM_HOSTS;

function isPlatform(value: string): value is Platform {
  return value in PLATFORM_HOSTS;
}

function matchesPlatform(url: string, platform: Platform) {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return PLATFORM_HOSTS[platform].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function detectPlatform(url: string): Platform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return (Object.keys(PLATFORM_HOSTS) as Platform[]).find((platform) =>
      PLATFORM_HOSTS[platform].some((host) => hostname === host || hostname.endsWith(`.${host}`)),
    ) || null;
  } catch {
    return null;
  }
}

// Retrieve access token from Spotify Web API
async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify API credentials are not configured in environment variables');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to authenticate with Spotify API');
  }

  const data = await response.json();
  return data.access_token;
}

// Fetch complete Spotify track metadata
async function getSpotifyMetadata(url: string): Promise<{
  artist: string;
  title: string;
  durationSec: number;
}> {
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  if (!match || !match[1]) {
    throw new Error('Invalid Spotify track URL');
  }

  const trackId = match[1];
  const token = await getSpotifyToken();

  let response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=from_token`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}?market=US`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!response.ok) {
    throw new Error('The requested track does not exist or has been removed from Spotify');
  }

  const trackData = await response.json();
  const artist = trackData.artists.map((item: { name: string }) => item.name).join(', ');
  const title = trackData.name;
  const durationSec = Math.round((trackData.duration_ms || 0) / 1000);

  return {
    artist,
    title,
    durationSec,
  };
}

// Strict matching to verify and download ONLY the original file
async function findExactAudioSource(metadata: {
  artist: string;
  title: string;
  durationSec: number;
}): Promise<string> {
  const { artist, title, durationSec } = metadata;

  type SearchEntry = { id: string; duration?: number; title?: string; uploader?: string };
  const clean = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  const titleTokens = clean(title).split(/\s+/).filter(Boolean);
  const artistTokens = clean(artist).split(/\s+/).filter(Boolean);
  const tokenOverlap = (value: string, tokens: string[]) => {
    if (!tokens.length) return 0;
    const normalized = clean(value);
    return tokens.filter((token) => normalized.includes(token)).length / tokens.length;
  };

  let entries: SearchEntry[] = [];
  try {
    const query = artist ? `ytsearch10:${artist} ${title}` : `ytsearch10:${title} audio`;
    const searchResults = await youtubedl(query, {
      dumpSingleJson: true,
      noWarnings: true,
      flatPlaylist: true,
    });
    entries = (searchResults as { entries?: SearchEntry[] }).entries || [];
  } catch {
    // Try SoundCloud below when YouTube search is unavailable.
  }

  const rankedMatch = entries
    .map((entry) => {
      const entryTitle = entry.title || '';
      const uploader = entry.uploader || '';
      const titleScore = tokenOverlap(entryTitle, titleTokens);
      const artistScore = tokenOverlap(`${uploader} ${entryTitle}`, artistTokens);
      const durationMatch =
        durationSec > 0 && entry.duration ? Math.abs(entry.duration - durationSec) <= 8 : false;

      return {
        entry,
        score: titleScore * 2 + artistScore + (durationMatch ? 2 : 0),
        trustedName: !artistTokens.length || artistScore > 0 || clean(uploader).includes('topic'),
        titleScore,
        durationMatch,
      };
    })
    .filter(
      (candidate) =>
        candidate.trustedName &&
        candidate.titleScore >= (candidate.durationMatch ? 0.34 : 0.5),
    )
    .sort((left, right) => right.score - left.score)[0];

  if (rankedMatch) {
    return `https://www.youtube.com/watch?v=${rankedMatch.entry.id}`;
  }

  // 3. Fallback to SoundCloud
  try {
    const scQuery = artist ? `scsearch5:${artist} ${title}` : `scsearch5:${title}`;
    const scResults = await youtubedl(scQuery, {
      dumpSingleJson: true,
      noWarnings: true,
      flatPlaylist: true,
    });
    const scEntries = (scResults as {
      entries?: Array<{ url?: string; webpage_url?: string; duration?: number; title?: string }>;
    }).entries || [];

    const matchedSc = scEntries.find((entry) => {
      const titleScore = tokenOverlap(entry.title || '', titleTokens);
      const durationMatch =
        durationSec > 0 && entry.duration ? Math.abs(entry.duration - durationSec) <= 8 : false;
      return titleScore >= (durationMatch ? 0.34 : 0.5);
    });

    if (matchedSc && (matchedSc.webpage_url || matchedSc.url)) {
      return matchedSc.webpage_url || matchedSc.url!;
    }
  } catch {
    // Continue if SoundCloud lookup fails
  }

  throw new Error(`No verified public recording was found for "${artist} - ${title}".`);
}

async function convert(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const requestedPlatformValue = request.nextUrl.searchParams.get('platform');
  const requestedFormat = request.nextUrl.searchParams.get('format') || 'mp3';
  const requestedQuality = request.nextUrl.searchParams.get('quality') || '192';

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  const requestedPlatform = requestedPlatformValue
    ? (isPlatform(requestedPlatformValue) ? requestedPlatformValue : null)
    : (url ? detectPlatform(url) : null);

  if (!requestedPlatform) {
    return NextResponse.json({ error: 'Unsupported source platform' }, { status: 400 });
  }

  try {
    if (!matchesPlatform(url, requestedPlatform)) {
      return NextResponse.json(
        { error: `The URL does not belong to the selected ${requestedPlatform} platform` },
        { status: 422 },
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid media URL' }, { status: 422 });
  }

  if (
    ['spotify', 'soundcloud', 'bandcamp'].includes(requestedPlatform) &&
    (requestedFormat === 'mp4' || requestedFormat === 'mpeg')
  ) {
    return NextResponse.json({ error: `${requestedPlatform} only supports audio formats` }, { status: 400 });
  }

  if (!(requestedFormat in FORMAT_CONFIG)) {
    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  }

  if (requestedFormat === 'mp3' && !MP3_QUALITIES.includes(requestedQuality as Mp3Quality)) {
    return NextResponse.json({ error: 'Unsupported MP3 quality' }, { status: 400 });
  }

  if (['mp4', 'mpeg'].includes(requestedFormat) && !VIDEO_QUALITIES.includes(requestedQuality as VideoQuality)) {
    return NextResponse.json({ error: 'Unsupported video quality' }, { status: 400 });
  }

  const formatConfig = FORMAT_CONFIG[requestedFormat as AudioFormat];
  const mediaType = formatConfig.mediaType;
  const numericQuality = Number(requestedQuality);
  const isPremiumMusic = mediaType === 'audio' && (numericQuality > LIMITS.free.maxMp3Quality || requestedFormat === 'flac' || requestedFormat === 'wav');
  const plan = getPlan(request);
  const identity = getUsageIdentity(request);
  const usageResult = consumeDownload(
    identity,
    plan,
    mediaType,
    numericQuality,
    isPremiumMusic,
  );

  if (!usageResult.allowed) {
    const response = NextResponse.json(
      { error: usageResult.error, code: 'LIMIT_REACHED', plan },
      { status: 429 },
    );
    response.cookies.set('mc-device-id', identity, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    return response;
  }

  let workDir: string | undefined;

  try {
    const format = formatConfig;
    const bitrate = requestedFormat === 'mp3' ? `${requestedQuality}k` : format.audioBitrate;

    let targetSource = url;
    let targetTitle = 'audio';

    if (requestedPlatform === 'spotify') {
      const spotifyInfo = await getSpotifyMetadata(url);
      targetTitle = `${spotifyInfo.artist} - ${spotifyInfo.title}`;
      targetSource = await findExactAudioSource(spotifyInfo);
    } else {
      const videoData = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        preferFreeFormats: true,
      });
      targetTitle = (videoData as { title?: string }).title || 'audio';
    }

    const cleanTitle = targetTitle
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .trim()
      .replace(/[. ]+$/, '') || 'audio';

    const filename = `${cleanTitle}.${format.extension}`;

    if (!ffmpegPath) {
      throw new Error('FFmpeg binary not resolved');
    }

    const binaryPath: string = ffmpegPath;

    workDir = await mkdtemp(path.join(os.tmpdir(), 'music-work-'));
    const outputPath = path.join(workDir, `output.${format.extension}`);

    const formatSelection =
      format.mediaType === 'video'
        ? `bestvideo[height<=${requestedQuality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${requestedQuality}]/best`
        : 'bestaudio/best';

    const subprocess = youtubedl.exec(targetSource, {
      output: '-',
      format: formatSelection,
    });

    if (!subprocess.stdout) {
      throw new Error('Failed to create stream from process stdout');
    }

    const ffmpegArgs: string[] = ['-loglevel', 'error', '-y', '-i', 'pipe:0'];

    if (format.mediaType === 'audio') {
      ffmpegArgs.push('-vn', '-codec:a', format.audioCodec);
      if (bitrate) {
        ffmpegArgs.push('-b:a', bitrate);
      }
    } else {
      ffmpegArgs.push('-c:v', format.videoCodec!, '-c:a', format.audioCodec);
    }

    ffmpegArgs.push('-f', format.outputFormat, outputPath);

    await new Promise<void>((resolve, reject) => {
      const converter = spawn(binaryPath, ffmpegArgs);

      if (converter.stdin) {
        subprocess.stdout!.pipe(converter.stdin);
      }

      converter.on('error', (err: Error) => reject(err));
      converter.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with error code ${code}`));
        }
      });

      subprocess.catch((err: unknown) => {
        converter.kill();
        reject(err);
      });
    });

    const fileStat = await stat(outputPath);
    const fileStream = createReadStream(outputPath);
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');

    fileStream.on('close', async () => {
      if (workDir) {
        await rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    const webStream = Readable.toWeb(fileStream);

    const response = new Response(webStream as ReadableStream, {
      headers: {
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Type': format.contentType,
        'Content-Length': fileStat.size.toString(),
      },
    });
    response.headers.set(
      'Set-Cookie',
      `mc-device-id=${encodeURIComponent(identity)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );
    return response;
  } catch (error) {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
    console.error('Download error details:', error);
    const rawError = error instanceof Error ? error.message : '';
    const errorMessage = /drm protected/i.test(rawError)
      ? `${requestedPlatform} does not provide a downloadable public stream for this item because it is DRM-protected. Choose another publicly available track.`
      : rawError || 'Failed to download media';
    return NextResponse.json({ error: errorMessage }, { status: 422 });
  }
}

export async function GET(request: NextRequest) {
  return convert(request);
}