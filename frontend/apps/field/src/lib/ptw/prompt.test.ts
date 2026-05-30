import { describe, expect, it } from 'vitest';

import { buildPtwPrompt } from './prompt.js';
import type { PtwFormState } from './types.js';
import { EMPTY_PTW_FORM } from './types.js';

const FILLED: PtwFormState = {
  ...EMPTY_PTW_FORM,
  job_description: 'Replace gasket on compressor K-101 suction flange',
  location: 'Compressor K-101 at Train A',
  work_type: 'hot_work',
  hazards: ['Hydrocarbon vapour', 'Hot surfaces'],
  controls: ['Isolate V-501'],
  isolations: ['V-501', 'ESD-101'],
  required_ppe: ['FRC coveralls'],
  issued_by: 'A. Issuer',
  performing_authority: 'B. Worker',
};

describe('buildPtwPrompt', () => {
  it('asks for the build_ptw_template tool with output_format=permit', () => {
    const text = buildPtwPrompt(FILLED, 'permit');
    expect(text).toMatch(/build_ptw_template/);
    expect(text).toMatch(/output_format="permit"/);
    expect(text).toMatch(/permit-to-work draft/);
  });

  it('switches the verb + format for toolbox talks', () => {
    const text = buildPtwPrompt(FILLED, 'toolbox_talk');
    expect(text).toMatch(/toolbox-talk briefing/);
    expect(text).toMatch(/output_format="toolbox_talk"/);
  });

  it('includes every supplied field labelled', () => {
    const text = buildPtwPrompt(FILLED, 'permit');
    expect(text).toContain('Hot work');
    expect(text).toContain('Compressor K-101 at Train A');
    expect(text).toContain('Replace gasket on compressor K-101 suction flange');
    expect(text).toContain('Hazards: Hydrocarbon vapour; Hot surfaces');
    expect(text).toContain('Isolations: V-501; ESD-101');
    expect(text).toContain('Issued by: A. Issuer');
    expect(text).toContain('Performing authority: B. Worker');
  });

  it('omits empty optional sections', () => {
    const minimal: PtwFormState = {
      ...EMPTY_PTW_FORM,
      job_description: 'Walkaround',
      location: 'Manifold M-201',
      work_type: 'cold_work',
    };
    const text = buildPtwPrompt(minimal, 'permit');
    expect(text).not.toContain('Hazards:');
    expect(text).not.toContain('Isolations:');
    expect(text).not.toContain('PPE:');
    expect(text).not.toContain('Issued by:');
  });

  it('emphasises the verification banner instruction', () => {
    const text = buildPtwPrompt(FILLED, 'permit');
    expect(text).toContain('verification banner');
  });
});
