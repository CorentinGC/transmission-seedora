import type { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '@/lib/site/hosts';

/** Both landing languages, each pointing at its alternate. */
export default function sitemap(): MetadataRoute.Sitemap {
  const languages = { en: `${SITE_ORIGIN}/`, fr: `${SITE_ORIGIN}/fr` };
  return [
    { url: `${SITE_ORIGIN}/`, changeFrequency: 'monthly', priority: 1, alternates: { languages } },
    { url: `${SITE_ORIGIN}/fr`, changeFrequency: 'monthly', priority: 0.8, alternates: { languages } },
  ];
}
