import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const unused = [
  "error",
  { argsIgnorePattern: "^_|^next$", ignoreRestSiblings: true },
];

export default [
  { ignores: ["**/node_modules/**", "client/dist/**", "playwright-report/**", "test-results/**", "e2e/.tmp/**"] },
  js.configs.recommended,

  // Server: CommonJS on Node
  {
    files: ["server/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node },
    rules: { "no-unused-vars": unused },
  },

  // Playwright config and browser tests: CommonJS on Node
  {
    files: ["playwright.config.js", "e2e/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: { "no-unused-vars": unused },
  },

  // Client: ES modules + React in the browser
  {
    files: ["client/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "no-unused-vars": unused,
    },
  },

  // Vite config and test files
  {
    files: ["client/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["client/**/*.test.{js,jsx}", "client/src/test-setup.js"],
    languageOptions: {
      globals: {
        describe: "readonly", it: "readonly", expect: "readonly",
        beforeEach: "readonly", afterEach: "readonly", vi: "readonly",
      },
    },
  },
];