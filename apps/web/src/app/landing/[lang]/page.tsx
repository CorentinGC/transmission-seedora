import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';
import { LANDING_CONTENT } from '@/lib/site/content';
import { LANDING_LANGS, SITE_ORIGIN, type LandingLang } from '@/lib/site/hosts';

interface Params {
  params: Promise<{ lang: string }>;
}

const pathFor = (lang: LandingLang): string => (lang === 'en' ? '/' : `/${lang}`);

function toLang(value: string): LandingLang | undefined {
  return LANDING_LANGS.find((candidate) => candidate === value);
}

export const dynamicParams = false;

export function generateStaticParams(): { lang: LandingLang }[] {
  return LANDING_LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const lang = toLang((await params).lang);
  if (!lang) return {};
  const content = LANDING_CONTENT[lang];
  const url = `${SITE_ORIGIN}${pathFor(lang)}`;
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: content.title,
    description: content.description,
    manifest: null,
    appleWebApp: undefined,
    alternates: {
      canonical: url,
      languages: { en: SITE_ORIGIN + '/', fr: `${SITE_ORIGIN}/fr`, 'x-default': SITE_ORIGIN + '/' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Seedora',
      title: content.title,
      description: content.description,
      url,
      locale: lang === 'en' ? 'en_US' : 'fr_FR',
      images: [{ url: '/landing/desktop-dark.png', width: 1280, height: 800, alt: content.alt.dark }],
    },
    twitter: {
      card: 'summary_large_image',
      title: content.title,
      description: content.description,
      images: ['/landing/desktop-dark.png'],
    },
  };
}

export default async function LandingRoute({ params }: Params) {
  const lang = toLang((await params).lang);
  if (!lang) notFound();
  const content = LANDING_CONTENT[lang];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Seedora',
    description: content.description,
    url: SITE_ORIGIN,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'macOS, Windows, Linux, Web',
    license: 'https://opensource.org/licenses/MIT',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    inLanguage: lang,
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <LandingPage lang={lang} />
    </>
  );
}
