module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // `module` is a PetroBrain domain term (well_control | emissions_mrv | ptw).
    // The Webpack-CommonJS shadowing this rule guards against does not apply to
    // these app-router client components.
    '@next/next/no-assign-module-variable': 'off',
  },
};
