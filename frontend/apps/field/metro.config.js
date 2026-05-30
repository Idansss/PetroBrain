// Metro configured for a pnpm workspace.
// - watchFolders is rooted at the monorepo so changes in /packages live-reload.
// - nodeModulesPaths includes the app's own node_modules first, then the
//   workspace root, so hoisted deps still resolve.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
