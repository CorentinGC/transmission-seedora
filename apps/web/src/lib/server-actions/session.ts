'use server';

import { cookies } from 'next/headers';
import type { ServerConfig } from '@shared/types';

const COOKIE_NAME = 'seedora_server';
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'seedora-dev-secret-change-in-production-32ch';

// Simple encryption using base64 for now — iron-session can be added later for stronger security
export async function setActiveServerCookie(config: ServerConfig): Promise<void> {
  const cookieStore = await cookies();
  const payload = JSON.stringify({
    host: config.host,
    port: config.port,
    path: config.path,
    useSSL: config.useSSL,
    username: config.username,
    password: config.password,
  });
  const encoded = Buffer.from(payload).toString('base64');
  cookieStore.set(COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getActiveServerFromCookie(): Promise<Partial<ServerConfig> | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const decoded = Buffer.from(cookie.value, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export async function clearServerCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
