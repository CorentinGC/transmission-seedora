import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { classifyHost, SITE_ORIGIN } from '@/lib/site/hosts';

/** The site is indexable; the app host is not (it is also sent `X-Robots-Tag: noindex`). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const role = classifyHost((await headers()).get('host'));
  if (role !== 'site') return { rules: { userAgent: '*', disallow: '/' } };
  return { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE_ORIGIN}/sitemap.xml` };
}
