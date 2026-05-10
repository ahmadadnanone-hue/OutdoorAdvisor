const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo config — wraps app.json and strips dev-only native keys that
 * expo-dev-client injects via its plugin. Without this, `expo prebuild`
 * would re-add NSLocalNetworkUsageDescription / NSBonjourServices on every
 * run, which Apple reviewers flag as unnecessary permission usage.
 */
module.exports = ({ config }) => {
  return withInfoPlist(config, (mod) => {
    // Remove Expo dev-client-only keys not needed in production.
    delete mod.modResults.NSLocalNetworkUsageDescription;
    delete mod.modResults.NSBonjourServices;

    if (mod.modResults.NSAppTransportSecurity) {
      delete mod.modResults.NSAppTransportSecurity.NSAllowsLocalNetworking;
      // Remove the entire key if now empty.
      if (Object.keys(mod.modResults.NSAppTransportSecurity).length === 0) {
        delete mod.modResults.NSAppTransportSecurity;
      }
    }

    return mod;
  });
};
