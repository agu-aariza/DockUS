module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["jsx-a11y"],
  extends: ["plugin:jsx-a11y/recommended"],
  ignorePatterns: [".tmp-test-dist", "dist", "node_modules"],
};
