import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Media Converter Music & Video',
  description: 'Privacy and cookie information for Media Converter Music & Video.',
};

export default function PrivacyPage() {
  return (
    <main className="theme-page min-h-screen bg-gradient-to-br from-orange-700 via-red-600 to-amber-800 px-4 py-10 text-slate-900">
      <article className="theme-card mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-2xl sm:p-10">
        <Link href="/" className="text-sm font-bold text-orange-700 hover:underline">← Back to converter</Link>
        <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Media Converter Music &amp; Video</p>
        <h1 className="mt-3 text-4xl font-black">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">We keep this service simple and transparent. This page explains what information is used when you convert a public media link.</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700">
          <section><h2 className="text-xl font-bold text-slate-900">Information we use</h2><p className="mt-2">The public media URL you submit is sent to our converter service to analyze and prepare your requested file. We do not ask for an account, name, or password.</p></section>
          <section><h2 className="text-xl font-bold text-slate-900">Cookies and usage limits</h2><p className="mt-2">We store your cookie choice in a small preference cookie and use a random HttpOnly device identifier to apply daily and monthly download limits. Your selected light or dark appearance is stored locally in your browser. These preferences are not used for advertising.</p></section>
          <section><h2 className="text-xl font-bold text-slate-900">Premium access</h2><p className="mt-2">If Premium billing is enabled, payment and subscription details are handled by the selected payment provider. We only retain the minimum entitlement information needed to apply Premium limits and do not store payment card details.</p></section>
          <section><h2 className="text-xl font-bold text-slate-900">Advertising</h2><p className="mt-2">The free version may show a limited number of clearly labeled advertisements. We do not place ads over the download button, interrupt conversions, or use autoplaying media advertisements. Premium is intended to be ad-free. Advertising is disabled until an advertising provider is configured.</p></section>
          <section><h2 className="text-xl font-bold text-slate-900">Third-party content</h2><p className="mt-2">Only submit links and download content that you have permission to use. The service does not grant rights to copyrighted material hosted by third-party platforms.</p></section>
          <section><h2 className="text-xl font-bold text-slate-900">Contact</h2><p className="mt-2">For privacy questions, please use the support channel provided by the website operator.</p></section>
        </div>
      </article>
    </main>
  );
}
