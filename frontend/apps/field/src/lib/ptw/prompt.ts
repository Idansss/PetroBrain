/**
 * Serialises a PTW form into the natural-language message we send to
 * ``POST /chat?module=ptw``.
 *
 * The orchestrator's PTW preamble (app/modules/ptw/agent.py) tells the
 * LLM to call ``build_ptw_template`` for permit content; the message
 * just needs to carry the form payload in a structured, copy-pasteable
 * way so the LLM forwards it accurately to the tool.
 */
import type { OutputFormat, PtwFormState } from './types.js';
import { WORK_TYPE_LABELS } from './types.js';

export function buildPtwPrompt(form: PtwFormState, outputFormat: OutputFormat): string {
  const verb = outputFormat === 'toolbox_talk' ? 'toolbox-talk briefing' : 'permit-to-work draft';
  const fields: string[] = [
    `Work type: ${WORK_TYPE_LABELS[form.work_type]}`,
    `Location: ${form.location}`,
    `Job: ${form.job_description}`,
  ];
  if (form.hazards.length > 0) {
    fields.push(`Hazards: ${form.hazards.join('; ')}`);
  }
  if (form.controls.length > 0) {
    fields.push(`Controls (supplied): ${form.controls.join('; ')}`);
  }
  if (form.isolations.length > 0) {
    fields.push(`Isolations: ${form.isolations.join('; ')}`);
  }
  if (form.required_ppe.length > 0) {
    fields.push(`PPE: ${form.required_ppe.join('; ')}`);
  }
  if (form.issued_by.trim()) {
    fields.push(`Issued by: ${form.issued_by.trim()}`);
  }
  if (form.performing_authority.trim()) {
    fields.push(`Performing authority: ${form.performing_authority.trim()}`);
  }
  if (form.asset_id) {
    fields.push(`Asset id: ${form.asset_id}`);
  }

  return [
    `Generate a ${verb} for the job below. Use the build_ptw_template tool with output_format="${outputFormat}". Preserve the verification banner.`,
    '',
    ...fields,
  ].join('\n');
}
