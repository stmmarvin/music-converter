'use client';

import { useState, useSyncExternalStore } from 'react';

const CONSENT_STORAGE_KEY = 'music-converter-cookie-consent';
const CONSENT_COOKIE_NAME = 'music-converter-consent';

type CookieConsent = 'accepted' | 'rejected' | null;

function getConsentCookie(): CookieConsent {
  const consentCookie = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${CONSENT_COOKIE_NAME}=`));
  const value = consentCookie?.split('=')[1];
  return value === 'accepted' ? 'accepted' : null;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('youtube');
  const [format, setFormat] = useState('mp3');
  const [quality, setQuality] = useState('192');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
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
    if (consent === 'accepted') {
      document.cookie = `${CONSENT_COOKIE_NAME}=accepted; Max-Age=31536000; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
      window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, 'rejected');
    }
    window.dispatchEvent(new Event('music-converter-consent-change'));
  };

  const handleDownload = async () => {
    setError('');

    if (!url.trim()) {
      setError('Please enter a media URL');
      return;
    }

    setIsLoading(true);

    try {
      const query = `platform=${platform}&url=${encodeURIComponent(url.trim())}&format=${format}&quality=${quality}`;
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
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isVideo = format === 'mp4' || format === 'mpeg';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl md:p-8">
          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">Media converter</p>
            <h1 className="text-3xl font-bold md:text-4xl">Download audio and video</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Paste a public media link, choose an output format, and download your file.
              Availability depends on the platform and its access restrictions.
            </p>
          </div>

          <div className="space-y-5">
          <div>
            <p className="mb-2 block text-sm font-medium text-slate-300">Source platform</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Source platform">
              {[
                { id: 'youtube', label: 'YouTube' },
                { id: 'vimeo', label: 'Vimeo' },
                { id: 'soundcloud', label: 'SoundCloud' },
                { id: 'bandcamp', label: 'Bandcamp' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={platform === item.id}
                  onClick={() => setPlatform(item.id)}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    platform === item.id
                      ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                      : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Click a platform to choose your source.</p>
          </div>

          <div>
            <label htmlFor="yt-url" className="block text-sm font-medium text-slate-300 mb-2">
              Media URL
            </label>

            <input
              id="media-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                platform === 'vimeo'
                  ? 'https://vimeo.com/...'
                  : platform === 'soundcloud'
                    ? 'https://soundcloud.com/...'
                    : platform === 'bandcamp'
                      ? 'https://artist.bandcamp.com/...'
                    : 'https://www.youtube.com/watch?v=...'
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder-slate-500 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="audio-format" className="block text-sm font-medium text-slate-300 mb-2">
              Output format
            </label>
            <select
              id="audio-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="Audio">
                <option value="mp3">MP3 - compact and widely supported</option>
                <option value="wav">WAV - uncompressed audio</option>
                <option value="m4a">M4A - AAC audio</option>
                <option value="flac">FLAC - lossless audio</option>
              </optgroup>
              <optgroup label="Video">
                <option value="mp4">MP4 - H.264 video</option>
                <option value="mpeg">MPEG - MPEG-2 video</option>
              </optgroup>
            </select>
          </div>

          {format === 'mp3' && (
            <div>
              <label htmlFor="mp3-quality" className="block text-sm font-medium text-slate-300 mb-2">
                MP3 quality
              </label>
              <select
                id="mp3-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="128">128 kbps - smaller file</option>
                <option value="192">192 kbps - balanced</option>
                <option value="320">320 kbps - highest quality</option>
              </select>
            </div>
          )}

          {isVideo && (
            <div>
              <label htmlFor="video-quality" className="block text-sm font-medium text-slate-300 mb-2">
                Video quality
              </label>
              <select
                id="video-quality"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="360">360p</option>
                <option value="480">480p</option>
                <option value="720">720p</option>
                <option value="1080">1080p</option>
              </select>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-xl border border-red-900/80 bg-red-950/40 p-4 text-sm font-medium text-red-300">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-700"
          >
            {isLoading ? 'Preparing download...' : `Download as ${format.toUpperCase()}`}
          </button>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-lg font-semibold">Platform support</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Choose the platform where your public media link comes from.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {['YouTube', 'Vimeo', 'SoundCloud', 'Bandcamp'].map((platform) => (
                <div key={platform} className="rounded-lg bg-emerald-950/40 px-3 py-2 text-emerald-300">
                  ✓ {platform}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      {cookieConsent === null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-consent-title"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-2xl border border-slate-700 bg-slate-800 p-5 shadow-2xl"
        >
          <h2 id="cookie-consent-title" className="text-lg font-semibold text-white">Use cookies?</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This website uses one preference cookie to remember your choice.
            You can reject cookies and continue using the converter.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => handleCookieConsent('rejected')}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => handleCookieConsent('accepted')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
