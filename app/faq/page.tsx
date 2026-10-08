import Link from 'next/link';

export const metadata = {
  title: 'FAQ | Media Converter Music & Video',
  description: 'Frequently asked questions about converting media.',
};

const questions = [
  ['Which platforms are supported?', 'You can currently analyze links from YouTube, Spotify, Vimeo, SoundCloud, Bandcamp, TikTok, and Instagram. Paste one URL and the platform is detected automatically.'],
  ['What are the free limits?', 'Free users can download up to 3 videos per day at a maximum of 720p and up to 20 standard music files per day.'],
  ['What does Premium unlock?', 'Premium unlocks up to 20 video downloads per day, video quality up to 4K, and up to 100 high-quality music downloads per month.'],
  ['Do I need an account?', 'No account is required for the free plan. A future checkout and account flow will be used to activate paid Premium access.'],
  ['Which formats can I choose?', 'Audio formats include MP3, WAV, M4A, and FLAC. Supported video links can also be exported as MP4 or MPEG.'],
  ['Why does a conversion fail?', 'The link may be private, unavailable, unsupported, or rate-limited by its source platform. Try a public link and analyze it again.'],
  ['When do limits reset?', 'Daily video and standard music limits reset at midnight UTC. The Premium high-quality music allowance resets at the start of each calendar month.'],
  ['Will the free version show advertisements?', 'Yes, the free version may show a small number of clearly labeled ads. There are no pop-ups or ads covering the download button. Premium is intended to be ad-free.'],
];

export default function FaqPage() {
  return (
    <main className="theme-page min-h-screen bg-gradient-to-br from-orange-700 via-red-600 to-amber-800 px-4 py-10 text-slate-900">
      <article className="theme-card mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
        <Link href="/" className="text-sm font-bold text-orange-700 hover:underline">← Back to converter</Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Help center</p>
        <h1 className="mt-3 text-4xl font-black">Frequently asked questions</h1>
        <div className="mt-8 divide-y divide-slate-200">
          {questions.map(([question, answer]) => <section key={question} className="py-6 first:pt-0 last:pb-0"><h2 className="text-lg font-bold text-slate-900">{question}</h2><p className="mt-2 text-sm leading-7 text-slate-600">{answer}</p></section>)}
        </div>
      </article>
    </main>
  );
}
