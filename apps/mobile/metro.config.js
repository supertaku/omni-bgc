const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Native caches and archived generated intermediates are not app assets/source.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : config.resolver.blockList ? [config.resolver.blockList] : []),
  /[\\/]\.g[\\/].*/,
  /[\\/]android[\\/].*/,
  /[\\/]ios[\\/].*/,
  /[\\/]artifacts[\\/].*/,
  /[\\/]\.cxx-m0-longpath[\\/].*/,
];
module.exports = config;
