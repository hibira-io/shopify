/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  env: { browser: true, node: true, es2022: true },
  extends: ["eslint:recommended"],
  overrides: [
    // The storefront script ships as a classic script, minified for ES2017.
    { files: ["storefront/**/*.js", "waiting-room/storefront/**/*.js"], parserOptions: { sourceType: "script" } },
  ],
};
