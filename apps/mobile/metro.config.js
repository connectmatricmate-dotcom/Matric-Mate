// Monorepo setup: Metro must watch the shared package and resolve modules from
// both the app and the repo root, since npm hoists dependencies upward.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
/**
 * Hierarchical lookup stays on, which is what expo/metro-config expects.
 * Turning it off is an old monorepo recipe that predates nodeModulesPaths, and
 * expo-doctor flags it because the two together can resolve a package at build
 * time that is not where the runtime looks for it.
 */

module.exports = config;
