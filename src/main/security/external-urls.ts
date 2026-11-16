const REPO_RELEASES = 'https://github.com/CorentinGC/transmission-seedora/releases';
const SAFE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * URL of the GitHub release notes of `version`, built from a hardcoded base (release-please tags are
 * `seedora-v<version>`). A version that is not plain semver falls back to the releases list.
 */
export function releaseNotesUrl(version: string): string {
  return SAFE_VERSION.test(version) ? `${REPO_RELEASES}/tag/seedora-v${version}` : REPO_RELEASES;
}
