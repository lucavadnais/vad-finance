import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/dist/', 'frontend/src/components/ui/'] },

  // Backend: plain JS on Node
  {
    files: ['backend/**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      // `const { secret, ...rest } = obj` is how we drop fields
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },

  // Frontend: Vue + TypeScript in the browser
  {
    files: ['frontend/**/*.{ts,vue}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...vue.configs['flat/recommended']],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
    rules: {
      // Pages are named after their route (HomePage), components are often one word
      'vue/multi-word-component-names': 'off',
      // Optional TS props are undefined when omitted, no default needed
      'vue/require-default-prop': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['frontend/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Formatting is Prettier's job: turn off the rules that would fight it
  prettier,
);
