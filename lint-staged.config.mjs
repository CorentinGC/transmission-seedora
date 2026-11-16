/**
 * Runs on staged files from the pre-commit hook (scripts/git-hooks/pre-commit).
 * Prettier is not listed yet: it is added once the repo-wide format commit has landed
 * (otherwise every touched file would be reformatted inside unrelated changes).
 */
export default {
  '*.{ts,tsx,mjs,js}': ['eslint --fix --no-warn-ignored --max-warnings=-1'],
};
