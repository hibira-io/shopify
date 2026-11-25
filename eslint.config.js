import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["extensions/*/assets/*.js", "waiting-room/extensions/*/assets/*.js"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    // ESLint 9 started flagging unused catch bindings; the ES2017 storefront
    // scripts need them, so keep the ESLint 8 behaviour.
    rules: { "no-unused-vars": ["error", { caughtErrors: "none" }] },
  },
  // The storefront scripts ship as a classic script, minified for ES2017.
  { files: ["storefront/**/*.js"], languageOptions: { sourceType: "script" } },
];
