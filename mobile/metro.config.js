const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// watch all workspace packages
config.watchFolders = [workspaceRoot];

// resolve modules from project root first, then workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// ensure workspace packages are resolved correctly
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
