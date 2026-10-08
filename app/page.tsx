'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import AdSlot from './components/AdSlot';

type MediaPreview = {
  platform?: string;
  title: string;
  duration: number;
  thumbnail: string | null;
  uploader?: string | null;
  webpageUrl?: string;
};

const CONSENT_STORAGE_KEY = 'music-converter-cookie-consent';
const THEME_STORAGE_KEY = 'music-converter-theme';
const CONSENT_COOKIE_NAME = 'music-converter-consent';
type CookieConsent = 'accepted' | 'rejected' | null;

function getConsentCookie(): CookieConsent {
  const consentCookie = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE_NAME}=`));
  const value = consentCookie?.slice(CONSENT_COOKIE_NAME.length + 1);
  return value === 'accepted' || value === 'rejected' ? value : null;
}

function saveConsentCookie(consent: Exclude<CookieConsent, null>) {
  document.cookie = `${CONSENT_COOKIE_NAME}=${consent}; Max-Age=31536000; Path=/; SameSite=Lax${
    window.location.protocol === 'https:' ? '; Secure' : ''
  }`;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [format, setFormat] = useState('mp3');
  const [quality, setQuality] = useState('192');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const cookieConsent = useSyncExternalStore<CookieConsent>(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      window.addEventListener('music-converter-consent-change', onStoreChange);
      return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener('music-converter-consent-change', onStoreChange);
      };
    },
    () => {
      const savedConsent = getConsentCookie() || window.localStorage.getItem(CONSENT_STORAGE_KEY);
      return savedConsent === 'accepted' || savedConsent === 'rejected' ? savedConsent : null;
    },
    () => null,
  );

  const handleCookieConsent = (consent: 'accepted' | 'rejected') => {
    saveConsentCookie(consent);
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    window.dispatchEvent(new Event('music-converter-consent-change'));
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setPreview(null);
    setAnalyzedUrl('');
    setError('');
  };

  const handleAnalyze = async (sourceUrl = url) => {
    setError('');
    setPreview(null);
    setAnalyzedUrl('');
    const trimmedUrl = sourceUrl.trim();

    if (!trimmedUrl) {
      setError('Please enter a media URL');
      return;
    }

    setIsLoading(true);
    setAnalysisProgress(5);
    const progressTimer = window.setInterval(() => {
      setAnalysisProgress((current) => (current >= 90 ? current : current + 5));
    }, 180);

    try {
      const response = await fetch(
        `/api/analyze?url=${encodeURIComponent(trimmedUrl)}`,
      );
      const result = (await response.json()) as MediaPreview & { error?: string };

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      setAnalysisProgress(100);
      setPreview(result);
      setPlatform(result.platform || '');
      setAnalyzedUrl(trimmedUrl);
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Analysis failed');
    } finally {
      window.clearInterval(progressTimer);
      setIsLoading(false);
    }
  };

  const handlePrepareFile = async () => {
    setError('');

    if (!preview || analyzedUrl !== url.trim()) {
      setError('Analyze the URL first, then download the previewed media');
      return;
    }

    setIsLoading(true);

    try {
    const query = `url=${encodeURIComponent(url.trim())}&format=${format}&quality=${quality}`;
    const response = await fetch(`/api/convert?${query}`);

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'Download failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const encodedFilename = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plainFilename = contentDisposition?.match(/filename="([^"]+)"/i)?.[1];
      const filename = encodedFilename
        ? decodeURIComponent(encodedFilename)
        : plainFilename || `download.${format}`;

      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = filename;
      const objectUrl = downloadLink.href;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : 'File download failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isVideo = format === 'mp4' || format === 'mpeg';
  const isPremiumFormat =
    (isVideo && Number(quality) > 720) ||
    (!isVideo && (Number(quality) > 192 || format === 'flac' || format === 'wav'));

  return (
    <main className="theme-page min-h-screen bg-gradient-to-br from-orange-700 via-red-600 to-amber-800 text-slate-900">
      <header className="border-b border-white/20 bg-slate-950/15">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" className="flex items-center gap-3 text-xl font-extrabold tracking-tight text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-orange-700 shadow-lg">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18V5l10-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="16" cy="16" r="3" />
              </svg>
            </span>
            Media Converter <span className="text-orange-100">Music &amp; Video</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-orange-50 sm:flex" aria-label="Main navigation">
            <a href="#converter" className="transition hover:text-white">Converter</a>
            <a href="#how-it-works" className="transition hover:text-white">Tutorial</a>
            <Link href="/faq" className="transition hover:text-white">FAQ</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
          </nav>
          <button
            type="button"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/20"
          >
            {theme === 'light' ? 'Dark mode' : 'Light mode'}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-20">
        <section className="mx-auto max-w-4xl text-center text-white">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-orange-200 shadow-[0_0_12px_#fed7aa]" />
            Music &amp; video, made simple
          </div>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
            Media Converter Music &amp; Video
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-orange-50 md:text-lg">
            Turn your favorite public media links into high-quality audio or video files.
            No sign-up, no complicated steps.
          </p>
        </section>

        <AdSlot placement="hero" />

        <section id="converter" className="theme-card mx-auto mt-10 max-w-3xl rounded-3xl bg-white p-5 shadow-2xl shadow-orange-950/25 sm:p-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">Start converting</p>
              <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Paste your media link</h2>
            </div>
            <div className="hidden rounded-2xl bg-orange-50 p-3 text-orange-600 sm:block">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 12h16M12 4v16" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="media-url" className="mb-2 block text-sm font-semibold text-slate-700">
              Media URL from any supported platform
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="media-url"
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder={
                    'Paste a YouTube, Spotify, Vimeo, SoundCloud, Bandcamp, TikTok, or Instagram URL'
                  }
                  className="theme-input min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 placeholder-slate-400 outline-none transition focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-100"
                />
                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  disabled={isLoading}
                  className="rounded-xl bg-orange-600 px-7 py-3.5 font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? `${analysisProgress}%` : 'Search'}
                </button>
              </div>
              <p className="mt-3 text-xs text-slate-500">Paste one public link. We detect the platform automatically.</p>
            </div>

            {isLoading && (
              <div className="h-2 overflow-hidden rounded-full bg-orange-100" aria-label={`Analysis ${analysisProgress}%`}>
                <div
                  className="h-full rounded-full bg-orange-500 transition-all duration-200"
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
            )}

            {preview && analyzedUrl === url.trim() && (
              <div className="overflow-hidden rounded-2xl border border-orange-200 bg-orange-50">
                {preview.thumbnail && (
                  <img src={preview.thumbnail} alt="" className="h-48 w-full object-cover" />
                )}
                <div className="space-y-2 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-orange-600">Search result · Preview</p>
                  <h2 className="text-lg font-semibold text-slate-900">{preview.title}</h2>
                  {preview.uploader && <p className="text-sm text-slate-500">{preview.uploader}</p>}
                  {preview.duration > 0 && (
                    <p className="text-sm text-slate-500">
                      Duration: {Math.floor(preview.duration / 60)}:{String(preview.duration % 60).padStart(2, '0')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {preview && analyzedUrl === url.trim() && (
              <div>
                <label htmlFor="audio-format" className="mb-2 block text-sm font-semibold text-slate-700">
                  Output format
                </label>
                <select
                  id="audio-format"
                  value={format}
                  onChange={(e) => {
                    setFormat(e.target.value);
                  }}
                  className="theme-input w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <optgroup label="Audio">
                    <option value="mp3">MP3 - compact and widely supported</option>
                    <option value="wav">WAV - uncompressed audio</option>
                    <option value="m4a">M4A - AAC audio</option>
                    <option value="flac">FLAC - lossless audio</option>
                  </optgroup>
                  {!['spotify', 'soundcloud', 'bandcamp'].includes(platform) && (
                    <optgroup label="Video">
                      <option value="mp4">MP4 - H.264 video</option>
                      <option value="mpeg">MPEG - MPEG-2 video</option>
                    </optgroup>
                  )}
                </select>
              </div>
            )}

            {preview && analyzedUrl === url.trim() && format === 'mp3' && (
              <div>
                <label htmlFor="mp3-quality" className="mb-2 block text-sm font-semibold text-slate-700">
                  MP3 quality
                </label>
                <select
                  id="mp3-quality"
                  value={quality}
                  onChange={(e) => {
                    setQuality(e.target.value);
                  }}
                  className="theme-input w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="128">128 kbps - smaller file</option>
                  <option value="192">192 kbps - balanced</option>
                  <option value="320">320 kbps - highest quality (Premium)</option>
                </select>
              </div>
            )}

            {isVideo && (
              <div>
                <label htmlFor="video-quality" className="mb-2 block text-sm font-semibold text-slate-700">
                  Video quality
                </label>
                <select
                  id="video-quality"
                  value={quality}
                  onChange={(e) => {
                    setQuality(e.target.value);
                  }}
                  className="theme-input w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="360">360p</option>
                  <option value="480">480p</option>
                  <option value="720">720p</option>
                  <option value="1080">1080p (Premium)</option>
                  <option value="1440">1440p (Premium)</option>
                  <option value="2160">2160p / 4K (Premium)</option>
                </select>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <aside className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">Free plan</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                3 videos per day up to 720p and 20 standard music downloads per day.
                Premium unlocks 4K video and high-quality music.
              </p>
              {isPremiumFormat && (
                <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-semibold text-orange-800">
                  This quality is Premium-only. Subscribe to unlock higher quality and larger limits.
                </p>
              )}
            </aside>

            {preview && analyzedUrl === url.trim() && (
              <button
                type="button"
                onClick={() => void handlePrepareFile()}
                disabled={isLoading}
                className="w-full rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:bg-slate-400"
              >
                {isLoading ? 'Converting and downloading...' : `Download ${format.toUpperCase()}`}
              </button>
            )}

            <AdSlot placement="results" />
          </div>
        </section>

        <section id="how-it-works" className="mx-auto mt-14 max-w-3xl text-center text-white">
          <h2 className="text-2xl font-extrabold">Simple, quick, and free</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-orange-50">
            Pick a platform, paste your link, and choose the format you want. Media Converter Music &amp; Video handles the rest.
          </p>
        </section>
      </div>

      {cookieConsent === null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-consent-title"
          className="theme-cookie fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-2xl rounded-2xl border border-orange-200 bg-white p-6 shadow-2xl sm:p-7"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Your privacy matters</p>
          <h2 id="cookie-consent-title" className="mt-2 text-2xl font-semibold text-slate-900">Cookies &amp; privacy</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            We use one preference cookie to remember your consent and your light/dark mode choice. We do not use cookies to sell personal information.
            Read our <Link href="/privacy" className="font-semibold text-orange-700 underline">Privacy Policy</Link> for more details.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => handleCookieConsent('rejected')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => handleCookieConsent('accepted')}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </main>
  );
}