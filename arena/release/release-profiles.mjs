/** Supported external versions select recipes explicitly; module package versions are independent. */
const profiles = {
 '0.2.0': { assets: 'legacy', rules: null },
 '0.2.1': { assets: 'legacy', rules: null },
 '0.3.0': { assets: 'current', rules: null },
 '0.4.0': { assets: 'current', rules: 'graph' },
 '0.4.1': { assets: 'current', rules: 'graph' },
 '0.5.0': { assets: 'mobility', rules: 'mobility' },
 '0.6.0': { assets: 'mobility', rules: 'mobility', composition: true },
};
export function releaseProfile(version) {
 if (!Object.hasOwn(profiles, version)) throw new Error(`Unsupported release version: ${version}`);
 return profiles[version];
}
