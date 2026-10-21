const js = require("@eslint/js");
const globals = require("globals");
const react = require("eslint-plugin-react");
const hooks = require("eslint-plugin-react-hooks");
module.exports = [{
  files: ["src/**/*.{js,jsx}"],
  languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } }, globals: { ...globals.browser, ...globals.node, ...globals.jest } },
  plugins: { react, "react-hooks": hooks },
  settings: { react: { version: "detect" } },
  rules: {
    ...js.configs.recommended.rules,
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-unused-vars": ["warn", { args: "none", caughtErrors: "none", ignoreRestSiblings: true, varsIgnorePattern: "^React$" }],
    "react/jsx-uses-vars": "error", "react/jsx-no-undef": "error", "react/jsx-key": "warn",
    "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "warn"
  }
}];
