import { describe, expect, it } from 'vitest';

import { permitToHtml } from './generate.js';
import type { GeneratedPermit } from './types.js';

const PERMIT: GeneratedPermit = {
  permit_id: 'PTW-DRAFT-abcdef01',
  format: 'permit',
  work_type: 'hot_work',
  location: 'Compressor K-101',
  job_description: 'Replace gasket on suction flange <inspect>',
  issued_by: 'A. Issuer',
  performing_authority: 'B. Worker',
  valid_from: null,
  valid_to: null,
  hazards: ['Hydrocarbon vapour'],
  controls: { supplied: ['Isolate V-501'], suggested: ['Gas test'], merged: ['Isolate V-501', 'Gas test'] },
  isolations: ['V-501'],
  required_ppe: { supplied: [], suggested: ['FRC coveralls'], merged: ['FRC coveralls'] },
  sign_off: {
    permit_issuer: { name: null, signed_utc: null },
    performing_authority: { name: null, signed_utc: null },
  },
  status: 'draft_unsigned',
  generated_utc: '2026-05-29T12:00:00Z',
  banner: 'DECISION SUPPORT ONLY. Verify and sign.',
  safety_critical: true,
  audit_sha256: 'deadbeef',
};

describe('permitToHtml', () => {
  it('includes the banner, controls, isolations, and a sign-off block', () => {
    const html = permitToHtml(PERMIT);
    expect(html).toContain('DECISION SUPPORT ONLY');
    expect(html).toContain('Compressor K-101');
    expect(html).toContain('Isolate V-501');
    expect(html).toContain('Gas test');
    expect(html).toContain('V-501');
    expect(html).toContain('Sign-off');
    expect(html).toContain('Permit Issuer');
    expect(html).toContain('Performing Authority');
  });

  it('escapes HTML special characters in user-supplied strings', () => {
    const html = permitToHtml(PERMIT);
    expect(html).toContain('Replace gasket on suction flange &lt;inspect&gt;');
    expect(html).not.toContain('<inspect>');
  });

  it('renders the briefing list for toolbox talks', () => {
    const talk: GeneratedPermit = {
      ...PERMIT,
      format: 'toolbox_talk',
      briefing: ['Today: gasket swap.', 'Stop-work authority is everyone’s.'],
    };
    const html = permitToHtml(talk);
    expect(html).toContain('Briefing');
    expect(html).toContain('Stop-work authority');
    expect(html).toContain('Toolbox-talk briefing');
  });
});
