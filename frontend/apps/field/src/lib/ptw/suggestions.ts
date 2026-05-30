/**
 * Phase-1 hazard/control/PPE suggestions surfaced inline in the form.
 *
 * Mirror the backend ``SUGGESTED_CONTROLS`` / ``SUGGESTED_PPE`` lists so
 * the user sees the same tap-to-add chips offline that the build_ptw_template
 * tool would merge in server-side. The user can override or add free-text.
 */
import type { WorkType } from './types.js';

export const HAZARD_SUGGESTIONS: Record<WorkType, string[]> = {
  hot_work: ['Hydrocarbon vapour', 'Hot surfaces', 'Spark/spatter', 'Explosive atmosphere'],
  cold_work: ['Stored energy', 'Slips, trips, falls', 'Pinch points'],
  confined_space: ['Oxygen deficiency', 'Toxic gas (H2S/CO)', 'Heat stress', 'Engulfment'],
  working_at_height: ['Falling person', 'Dropped object', 'Unstable platform'],
  electrical: ['Arc flash', 'Stored capacitance', 'Inadvertent re-energisation'],
  excavation: ['Cave-in', 'Buried services', 'Plant struck-by'],
  diving: ['Decompression sickness', 'Entrapment', 'Hyperbaric medical emergency'],
  radiography: ['Ionising radiation exposure', 'Source recovery failure'],
  lifting: ['Load drop', 'Sling failure', 'Tag-line tension'],
};

export const CONTROL_SUGGESTIONS: Record<WorkType, string[]> = {
  hot_work: [
    'Continuous gas test (HC + O2 + H2S)',
    'Competent fire watch with extinguishers',
    'Isolate adjacent process equipment',
    'Remove combustibles 10 m radius',
    '30-min fire watch after completion',
  ],
  cold_work: ['Verify isolations', 'Intrinsically-safe tools', 'Housekeeping discipline'],
  confined_space: [
    'Continuous atmospheric monitoring',
    'Trained attendant at entry',
    'Briefed rescue plan + retrieval equipment',
  ],
  working_at_height: [
    'Full body harness anchored above shoulder',
    'Inspect fall-arrest equipment',
    'Exclusion zone below work area',
    'Suspended-worker rescue plan',
  ],
  electrical: [
    'LOTO at every isolation point',
    'Verify zero energy with attempted start',
    'Arc-flash PPE per boundary calculation',
  ],
  excavation: [
    'Underground services survey reviewed on site',
    'Shoring or battering per soil',
    'Plant spotter within 1.5 m of edge',
  ],
  diving: ['Authorised diving contractor + supervisor', 'Hyperbaric chamber availability confirmed'],
  radiography: [
    'Restricted area boundary established',
    'Personal dosimeters issued',
    'Source recovery procedure rehearsed',
  ],
  lifting: ['Signed lift plan', 'Inspected slings & shackles', 'Tag lines + no personnel under load'],
};

export const PPE_SUGGESTIONS: Record<WorkType, string[]> = {
  hot_work: ['FRC coveralls', 'Welding shield', 'Gas-tight gloves', 'Hearing protection'],
  cold_work: ['Coveralls', 'Safety glasses', 'Cut-resistant gloves', 'Hard hat'],
  confined_space: ['BA/SCBA', 'Harness with retrieval line', 'Communications headset'],
  working_at_height: ['Full-body harness', 'Helmet with chin strap', 'Anti-trauma loops'],
  electrical: ['Arc-flash suit (per study)', 'Insulated gloves'],
  excavation: ['Hi-vis', 'Steel-toe boots', 'Hard hat'],
  diving: ['Per dive contractor PPE matrix'],
  radiography: ['Personal dosimeter', 'Survey meter'],
  lifting: ['Hi-vis', 'Hard hat', 'Steel-toe boots'],
};
