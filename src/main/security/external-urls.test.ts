import { describe, expect, it } from 'vitest';
import { releaseNotesUrl } from './external-urls';

describe('releaseNotesUrl', () => {
  it('points at the tag of the running version', () => {
    expect(releaseNotesUrl('1.2.2')).toBe(
      'https://github.com/CorentinGC/transmission-seedora/releases/tag/seedora-v1.2.2',
    );
    expect(releaseNotesUrl('2.0.0-beta.1')).toContain('/tag/seedora-v2.0.0-beta.1');
  });

  it.each(['', '1.2', '1.2.2/../../x', '1.2.2?x=1', 'javascript:alert(1)', '1.2.2 '])(
    'falls back to the releases list for %j',
    (version) => {
      expect(releaseNotesUrl(version)).toBe('https://github.com/CorentinGC/transmission-seedora/releases');
    },
  );
});
