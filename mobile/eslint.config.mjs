import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
  // global ignores
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "metro.config.js",
      "babel.config.js",
    ],
  },

  // base eslint recommended rules
  eslint.configs.recommended,

  // typescript rules
  ...tseslint.configs.recommended,

  // typescript configuration
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "prefer-const": "warn",
    },
  },

  // disable rules that conflict with prettier
  prettierConfig
);
