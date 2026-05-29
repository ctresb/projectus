/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-hex': true,
    'declaration-property-value-disallowed-list': {
      '/^(padding|margin|gap)/': [/\d{2,}px/],
    },
    // Flat BEM + intentional overrides.
    'selector-class-pattern': null,
    'no-descending-specificity': null,
    'keyframes-name-pattern': null,
  },
  ignoreFiles: ['**/*.module.css', '**/dist/**', '**/target/**', '**/node_modules/**'],
  overrides: [
    {
      // tokens.css is the source-of-truth hex mirror of tokens.json — raw hex is mandatory here.
      files: ['**/styles/tokens.css'],
      rules: { 'color-no-hex': null },
    },
  ],
}
