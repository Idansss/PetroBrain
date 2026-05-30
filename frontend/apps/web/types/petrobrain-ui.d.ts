// Tailwind preset is shipped as ``.cjs`` (Tailwind's loader can't read .ts
// at config-build time); declare its module shape so the typechecker
// stops at the import.
declare module '@petrobrain/ui/tailwind-preset' {
  import type { Config } from 'tailwindcss';
  const preset: Partial<Config>;
  export default preset;
}
