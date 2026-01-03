const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Add workspace root to watch folders (keep defaults)
config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

// Add workspace node_modules to resolution paths
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Add extra modules that need to be resolved from workspace
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Resolve convex/_generated from web app
  "convex/_generated": path.resolve(workspaceRoot, "web/convex/_generated"),
};

module.exports = config;
