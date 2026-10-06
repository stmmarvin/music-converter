import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import youtubedl from 'youtube-dl-exec';
import { Readable } from 'stream';

const FORMAT_CONFIG = {
  mp3: { extension: 'mp3', contentType: 'audio/mpeg', mediaType: 'audio', videoCodec: undefined, audioCodec: 'libmp3lame', audioBitrate: '192k', outputFormat: 'mp3' },
  wav: { extension: 'wav', contentType: 'audio/wav', mediaType: 'audio', videoCodec: undefined, audioCodec: 'pcm_s16le', audioBitrate: undefined, outputFormat: 'wav' },
  m4a: { extension: 'm4a', contentType: 'audio/mp4', mediaType: 'audio', videoCodec: undefined, audioCodec: 'aac', audioBitrate: '192k', outputFormat: 'ipod' },
  flac: { extension: 'flac', contentType: 'audio/flac', mediaType: 'audio', videoCodec: undefined, audioCodec: 'flac', audioBitrate: undefined, outputFormat: 'flac' },
  mp4: { extension: 'mp4', contentType: 'video/mp4', mediaType: 'video', videoCodec: 'libx264', audioCodec: 'aac', audioBitrate: undefined, outputFormat: 'mp4' },
  mpeg: { extension: 'mpeg', contentType: 'video/mpeg', mediaType: 'video', videoCodec: 'mpeg2video', audioCodec: 'mp2', audioBitrate: undefined, outputFormat: 'mpeg' },
} as const;

type AudioFormat = keyof typeof FORMAT_CONFIG;
const MP3_QUALITIES = ['128', '192', '320'] as const;
type Mp3Quality = (typeof MP3_QUALITIES)[number];
const VIDEO_QUALITIES = ['360', '480', '720', '1080'] as const;
type VideoQuality = (typeof VIDEO_QUALITIES)[number];

const PLATFORM_HOSTS = {
  youtube: ['youtube.com', 'youtu.be'],
  vimeo: ['vimeo.com'],
  soundcloud: ['soundcloud.com'],
  bandcamp: ['bandcamp.com'],
} as const;

type Platform = keyof typeof PLATFORM_HOSTS;

function isPlatform(value: string): value is Platform {
  return value in PLATFORM_HOSTS;
}

function matchesPlatform(url: string, platform: Platform) {
  const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  return PLATFORM_HOSTS[platform].some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function getPlatformError(url: string) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname === 'music.apple.com' || hostname.endsWith('.music.apple.com')) {
      return 'Apple Music links usually contain DRM-protected streams. The song page can be recognized, but the audio cannot be downloaded.';
    }
    if (hostname === 'music.amazon.com' || hostname.endsWith('.music.amazon.com')) {
      return 'Amazon Music links usually contain DRM-protected streams. This audio cannot be downloaded.';
    }
  } catch {
    return 'Invalid media URL';
  }

  return null;
}

async function convert(request: NextRequest, cookiesPath?: string, cleanup?: () => Promise<void>) {
  const url = request.nextUrl.searchParams.get('url');
  const requestedPlatform = request.nextUrl.searchParams.get('platform') || 'youtube';
  const requestedFormat = request.nextUrl.searchParams.get('format') || 'mp3';
  const requestedQuality = request.nextUrl.searchParams.get('quality') || '192';

  if (!url) {
    return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
  }

  if (!isPlatform(requestedPlatform)) {
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

  const platformError = getPlatformError(url);
  if (platformError) {
    return NextResponse.json({ error: platformError }, { status: 422 });
  }

  if (!(requestedFormat in FORMAT_CONFIG)) {
    return NextResponse.json({ error: 'Unsupported audio format' }, { status: 400 });
  }

  if (requestedFormat === 'mp3' && !MP3_QUALITIES.includes(requestedQuality as Mp3Quality)) {
    return NextResponse.json({ error: 'Unsupported MP3 quality' }, { status: 400 });
  }

  if (['mp4', 'mpeg'].includes(requestedFormat) && !VIDEO_QUALITIES.includes(requestedQuality as VideoQuality)) {
    return NextResponse.json({ error: 'Unsupported video quality' }, { status: 400 });
  }

  try {
    const format = FORMAT_CONFIG[requestedFormat as AudioFormat];
    const bitrate = requestedFormat === 'mp3' ? `${requestedQuality}k` : format.audioBitrate;
    // Fetch video metadata to obtain the clean title
    const videoData = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      ...(cookiesPath ? { cookies: cookiesPath } : {}),
    });

    const rawTitle = (videoData as { title?: string }).title || 'audio';
    const cleanTitle = rawTitle
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .trim()
      .replace(/[. ]+$/, '') || 'audio';
    const filename = `${cleanTitle}.${format.extension}`;

    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available for media conversion');
    }

    const ffmpegArgs = ['-loglevel', 'error'];
    let subprocess: ReturnType<typeof youtubedl.exec> | undefined;

    if (format.mediaType === 'video') {
      const formats = (videoData as {
        formats?: Array<{ height?: number; ext?: string; vcodec?: string; acodec?: string; url?: string }>;
      }).formats || [];
      const maxHeight = Number(requestedQuality);
      const video = formats
        .filter((item) => item.url && item.ext === 'mp4' && item.vcodec && item.vcodec !== 'none' && (item.height || 0) <= maxHeight)
        .sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      const audio = formats.find((item) => item.url && item.acodec && item.acodec !== 'none' && item.ext === 'm4a');

      if (!video?.url || !audio?.url) {
        throw new Error(`No compatible video/audio stream found for ${requestedQuality}p`);
      }

      ffmpegArgs.push('-i', video.url, '-i', audio.url);
    } else {
      // Prefer direct HTTPS M4A/MP4 audio streams to avoid unstable WebM URLs.
      subprocess = youtubedl.exec(url, {
        output: '-',
        format: 'bestaudio[ext=m4a]/bestaudio[ext=mp4]',
        ...(cookiesPath ? { cookies: cookiesPath } : {}),
      });

      if (!subprocess.stdout) {
        throw new Error('Failed to create audio stream from process stdout');
      }

    }

    const converter = spawn(ffmpegPath, [
      ...ffmpegArgs,
      ...(format.mediaType === 'audio' ? ['-i', 'pipe:0'] : []),
      ...(format.mediaType === 'video'
        ? ['-c:v', format.videoCodec, '-c:a', format.audioCodec]
        : ['-vn', '-codec:a', format.audioCodec]),
      ...(bitrate ? ['-b:a', bitrate] : []),
      ...(requestedFormat === 'mp4' ? ['-movflags', 'frag_keyframe+empty_moov'] : []),
      '-f',
      format.outputFormat,
      'pipe:1',
    ]);

    if (subprocess?.stdout) {
      subprocess.stdout.pipe(converter.stdin);
    }

    // The stream is returned before yt-dlp exits, so consume its promise to
    // prevent a failed child process from becoming an unhandled rejection.
    if (subprocess) {
      void subprocess.catch((streamError) => {
        console.error('Audio stream error details:', streamError);
        converter.stdin.destroy(streamError);
        converter.kill();
      });
    }

    converter.on('error', (conversionError) => {
      console.error('MP3 conversion error details:', conversionError);
      subprocess?.kill();
    });
    converter.on('close', () => {
      void cleanup?.();
    });

    // Convert FFmpeg's Node process stdout to a standard Web ReadableStream.
    const webStream = Readable.toWeb(converter.stdout);

    return new Response(webStream as ReadableStream, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Content-Type': format.contentType,
      },
    });
  } catch (error) {
    // Log failure details in the console for debugging
    console.error('Download error details:', {
      error,
      message: error instanceof Error ? error.message : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      details: error && typeof error === 'object' ? Object.getOwnPropertyNames(error) : undefined,
    });
    const errorMessage = error instanceof Error && error.message ? error.message : 'Failed to download audio';
    const isExtractorError = /unsupported url|no video formats found|unable to download|private video|drm/i.test(errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: isExtractorError ? 422 : 500 });
  }
}

export async function GET(request: NextRequest) {
  return convert(request);
}

export async function POST(request: NextRequest) {
  let temporaryDirectory: string | undefined;
  let handedOffToStream = false;

  try {
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'Use multipart/form-data with a cookies.txt file' }, { status: 400 });
    }

    const formData = await request.formData();
    const cookies = formData.get('cookies');

    if (!(cookies instanceof File) || cookies.size === 0) {
      return NextResponse.json({ error: 'A cookies.txt file is required' }, { status: 400 });
    }

    if (cookies.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'The cookies.txt file is too large' }, { status: 400 });
    }

    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'music-converter-'));
    const cookiesPath = path.join(temporaryDirectory, 'cookies.txt');
    await writeFile(cookiesPath, Buffer.from(await cookies.arrayBuffer()), { mode: 0o600 });

    const response = await convert(
      request,
      cookiesPath,
      () => rm(temporaryDirectory!, { recursive: true, force: true }),
    );
    handedOffToStream = true;
    return response;
  } finally {
    if (temporaryDirectory && !handedOffToStream) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}