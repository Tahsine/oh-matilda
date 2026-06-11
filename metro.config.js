const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Expo SDK 54 enables package exports resolution (unstable_enablePackageExports)
// by default, which blocks subpath imports for packages without an "exports" field.
// mammoth uses bluebird/js/release/promise which is not in bluebird's exports.
const origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, moduleName, platform) => {
  if (moduleName.startsWith('bluebird/')) {
    return {
      filePath: path.join(__dirname, 'node_modules', moduleName) + '.js',
      type: 'sourceFile',
    };
  }
  return origResolveRequest
    ? origResolveRequest(ctx, moduleName, platform)
    : ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './app/global.css' })
