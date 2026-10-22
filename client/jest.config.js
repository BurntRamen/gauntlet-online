module.exports = {
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  testEnvironment: "jsdom", setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"],
  transform: { "^.+\\.[jt]sx?$": "<rootDir>/config/jest/babelTransform.js", "^.+\\.css$": "<rootDir>/config/jest/assetTransform.js", "^(?!.*\\.(js|jsx|mjs|cjs|json)$)": "<rootDir>/config/jest/assetTransform.js" },
  transformIgnorePatterns: ["[/\\\\]node_modules[/\\\\]"],
  moduleFileExtensions: ["web.js", "js", "jsx", "json", "node"],
  resetMocks: true, coverageProvider: "v8", collectCoverageFrom: ["src/**/*.{js,jsx}"]
};
