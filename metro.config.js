// Learn more https://docs.expo.io/guides/customizing-metro
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the project and workspace directories
// eslint-disable-next-line no-undef
const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// When enabled, the optional code below will allow Metro to resolve
// and bundle source files with TV-specific extensions
// (e.g., *.ios.tv.tsx, *.android.tv.tsx, *.tv.tsx)
//
// Metro will still resolve source files with standard extensions
// as usual if TV-specific files are not found for a module.
//
// if (process.env?.EXPO_TV === '1') {
//   const originalSourceExts = config.resolver.sourceExts;
//   const tvSourceExts = [
//     ...originalSourceExts.map((e) => `tv.${e}`),
//     ...originalSourceExts,
//   ];
//   config.resolver.sourceExts = tvSourceExts;
// }

function findWorkspaceRoot(startDir) {
  let currentDir = path.dirname(startDir);

  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, "package.json");

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

        if (packageJson.workspaces) {
          return currentDir;
        }
      } catch {
        return null;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

const workspaceRoot = findWorkspaceRoot(projectRoot);

// 只有在真实的 workspace 环境下才扩展 Metro 搜索范围，避免把整个用户目录加入监听。
if (workspaceRoot) {
  config.watchFolders = [workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(workspaceRoot, "node_modules"),
  ];
  config.resolver.disableHierarchicalLookup = true;
}

module.exports = config;
