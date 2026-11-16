import type { LandingLang } from '@/lib/site/hosts';
import { APP_ORIGIN } from '@/lib/site/hosts';
import { LANDING_CONTENT } from '@/lib/site/content';

const REPO_URL = 'https://github.com/CorentinGC/transmission-seedora';
const RELEASES_URL = `${REPO_URL}/releases/latest`;

/** Marketing page for seedora.app. Server component, no client JavaScript. */
export function LandingPage({ lang }: { lang: LandingLang }) {
  const c = LANDING_CONTENT[lang];
  const button =
    'inline-flex h-11 items-center rounded-md px-5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
  return (
    <div lang={c.htmlLang} className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <img src="/icons/icon-192.png" alt="" width={32} height={32} />
          Seedora
        </span>
        <a
          href={c.otherLanguage.href}
          hrefLang={lang === 'en' ? 'fr' : 'en'}
          className="text-sm text-muted-foreground underline"
        >
          {c.otherLanguage.label}
        </a>
      </header>
      <main>
        <section className="mx-auto max-w-5xl px-4 py-12 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">{c.heroTitle}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{c.heroText}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={APP_ORIGIN} className={`${button} bg-primary text-primary-foreground`}>
              {c.openApp}
            </a>
            <a href="#download" className={`${button} border bg-secondary text-secondary-foreground`}>
              {c.download}
            </a>
          </div>
          <img
            src="/landing/desktop-dark.png"
            alt={c.alt.dark}
            width={1280}
            height={800}
            fetchPriority="high"
            className="mx-auto mt-12 h-auto w-full max-w-4xl rounded-lg border shadow-lg"
          />
        </section>
        <section className="mx-auto max-w-5xl px-4 py-12" aria-labelledby="features">
          <h2 id="features" className="text-center text-2xl font-semibold">
            {c.featuresTitle}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((feature) => (
              <li key={feature.title} className="rounded-lg border bg-card p-5 text-card-foreground">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="mx-auto max-w-5xl px-4 py-12" aria-labelledby="screens">
          <h2 id="screens" className="text-center text-2xl font-semibold">
            {c.screenshotsTitle}
          </h2>
          <div className="mt-8 grid items-start gap-4 md:grid-cols-[2fr_1fr]">
            <img
              src="/landing/desktop-light.png"
              alt={c.alt.light}
              width={1280}
              height={800}
              loading="lazy"
              className="h-auto w-full rounded-lg border"
            />
            <img
              src="/landing/mobile-dark.png"
              alt={c.alt.mobile}
              width={390}
              height={844}
              loading="lazy"
              className="mx-auto h-auto w-56 rounded-lg border md:w-full"
            />
          </div>
        </section>
        <section id="download" className="mx-auto max-w-5xl px-4 py-12 text-center" aria-labelledby="install">
          <h2 id="install" className="text-2xl font-semibold">
            {c.downloadTitle}
          </h2>
          <p className="mt-2 text-muted-foreground">{c.downloadText}</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {c.platforms.map((platform) => (
              <li key={platform.name}>
                <a
                  href={RELEASES_URL}
                  rel="noopener"
                  className="block rounded-lg border bg-card p-5 text-card-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <span className="block font-semibold">{platform.name}</span>
                  <span className="block text-sm text-muted-foreground">{platform.formats}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="mx-auto max-w-5xl border-t px-4 py-8 text-center text-sm text-muted-foreground">
        <p>
          {c.openSource}{' '}
          <a href={REPO_URL} rel="noopener" className="underline">
            {c.github}
          </a>
        </p>
      </footer>
    </div>
  );
}
