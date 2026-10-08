import Link from 'next/link';

export const metadata = {
  title: 'Tutorial | Media Converter Music & Video',
  description: 'Learn how to convert a media link in three simple steps.',
};

export default function TutorialPage() {
  return (
    <main className="theme-page min-h-screen bg-gradient-to-br from-orange-700 via-red-600 to-amber-800 px-4 py-10 text-slate-900">
      <article className="theme-card mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
        <Link href="/" className="text-sm font-bold text-orange-700 hover:underline">← Back to converter</Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Quick tutorial</p>
        <h1 className="mt-3 text-4xl font-black">How to convert a media link</h1>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ['01', 'Paste one URL', 'Use a public link from YouTube, Spotify, Vimeo, SoundCloud, Bandcamp, TikTok, or Instagram. The platform is detected automatically.'],
            ['02', 'Paste your link', 'Paste a public media URL and press Analyze.'],
            ['03', 'Choose and download', 'Select your format and quality, prepare the file, and download it.'],
            ['04', 'Upgrade when needed', 'Higher-quality music, 1080p–4K video, and larger limits require Premium access.'],
          ].map(([number, title, description]) => <section key={number} className="rounded-2xl border border-orange-100 bg-orange-50 p-5"><span className="text-3xl font-black text-orange-700">{number}</span><h2 className="mt-4 font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></section>)}
        </div>
      </article>
    </main>
  );
}
