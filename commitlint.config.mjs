/**
 * Conventional Commits enforcement. The type drives release-please: `feat`, `fix` and `perf`
 * ship a version, the others do not (see docs/release.md).
 */
export default {
  extends: ['@commitlint/config-conventional'],
  // The beads CLI writes this commit itself (`bd init`) and it predates the convention.
  ignores: [(message) => message.startsWith('bd init: ')],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert'],
    ],
    'subject-case': [0],
    // Dependabot and release-please generate long body/footer lines.
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
