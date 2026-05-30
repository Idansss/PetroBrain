const state = {
  sources: [],
  lastMrvResult: null,
};

const sourceSamples = {
  flaring: {
    sourceId: "FL-1",
    params: {
      gas_volume_scf: 1000000,
      composition: { CH4: 1.0 },
      combustion_efficiency: 0.98,
      measured: true,
    },
  },
  venting: {
    sourceId: "V-1",
    params: {
      gas_volume_scf: 100000,
      composition: { CH4: 0.92, CO2: 0.04, N2: 0.04 },
      measured: true,
    },
  },
  fugitive_t2: {
    sourceId: "AREA-1",
    params: {
      component_counts: { valve: 100, flange: 200 },
      operating_hours: 8760,
    },
  },
  fugitive_t3: {
    sourceId: "AREA-2",
    params: {
      measured_leaks_kg_ch4_per_hr: [0.5, 0.3, 0.2],
      operating_hours: 8760,
    },
  },
  combustion: {
    sourceId: "GT-1",
    params: {
      fuel_scf: 500000,
      co2_kg_per_scf: 0.0545,
      ch4_kg_per_scf: 0.000001,
      n2o_kg_per_scf: 0.0000001,
      measured: false,
    },
  },
};

const inventorySamples = {
  tier3Ready: {
    facility_id: "FAC-1",
    period: "2026-Q3",
    operator: "Demo E&P",
    asset: "OML-DEMO",
    sources: [
      { source_id: "FL-1", source_type: "flaring", params: sourceSamples.flaring.params },
      { source_id: "AREA-2", source_type: "fugitive_t3", params: sourceSamples.fugitive_t3.params },
    ],
  },
  transitionGaps: {
    facility_id: "FAC-2",
    period: "2026-Q3",
    operator: "Demo E&P",
    asset: "OML-GAP",
    sources: [
      { source_id: "FL-2", source_type: "flaring", params: { ...sourceSamples.flaring.params, measured: false } },
      { source_id: "AREA-1", source_type: "fugitive_t2", params: sourceSamples.fugitive_t2.params },
      { source_id: "GT-1", source_type: "combustion", params: sourceSamples.combustion.params },
    ],
  },
};

function authHeaders() {
  const token = document.querySelector("#authToken").value.trim();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail || response.statusText;
    throw new Error(Array.isArray(detail) ? JSON.stringify(detail) : detail);
  }
  return body;
}

async function getJson(url) {
  const response = await fetch(url, { headers: authHeaders() });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail || response.statusText;
    throw new Error(Array.isArray(detail) ? JSON.stringify(detail) : detail);
  }
  return body;
}

function setBusy(form, busy) {
  form.querySelectorAll("button, input, select, textarea").forEach((el) => {
    el.disabled = busy;
  });
}

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function numberFromForm(data, name) {
  const raw = data[name];
  if (raw === "" || raw === null || raw === undefined) return null;
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`${name} must be numeric`);
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderError(target, error) {
  target.innerHTML = `<div class="error">${escapeHtml(error.message || error)}</div>`;
}

function renderFlags(flags = []) {
  if (!flags.length) return "";
  return `<div class="flag-list">${flags.map((flag) => `<span class="flag">${escapeHtml(flag)}</span>`).join("")}</div>`;
}

function renderJson(data) {
  return `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
}

function renderMetric(label, value, unit = "") {
  const suffix = unit ? ` ${unit}` : "";
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}${escapeHtml(suffix)}</strong></div>`;
}

function renderRows(rows, columns) {
  if (!rows || !rows.length) return '<div class="empty">No rows.</div>';
  const head = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => `<td>${escapeHtml(row[col.key] ?? "")}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderActionTable(rows, columns, actionLabel, actionAttr) {
  if (!rows || !rows.length) return '<div class="empty">No saved records.</div>';
  const head = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("") + "<th>Action</th>";
  const body = rows
    .map((row) => {
      const cells = columns
        .map((col) => `<td>${escapeHtml(row[col.key] ?? "")}</td>`)
        .join("");
      return `<tr>${cells}<td><button class="secondary compact" type="button" ${actionAttr}="${escapeHtml(row[actionAttr === "data-mrv-id" ? "inventory_id" : "ingest_id"])}">${escapeHtml(actionLabel)}</button></td></tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function documentPayload() {
  const form = document.querySelector("#documentForm");
  const data = formObject(form);
  const file = document.querySelector("#documentFile").files[0];
  return {
    filename: file?.name || `${data.document_id || "document"}.md`,
    document_id: data.document_id,
    title: data.title,
    revision: data.revision || "",
    jurisdiction: data.jurisdiction || "",
    asset: data.asset || null,
    effective_date: data.effective_date || null,
    document_type: data.document_type || "sop",
    text: data.text,
  };
}

function renderDocumentResult(data) {
  const saved = data.ingest_id
    ? `<div class="section saved-record"><h3>Saved Document</h3><code>${escapeHtml(data.ingest_id)}</code><span>${escapeHtml(data.created_utc)}</span></div>`
    : "";
  const chunks = data.chunks || [];
  const rows = renderRows(chunks, [
    { key: "chunk_index", label: "#" },
    { key: "clause", label: "Clause" },
    { key: "text", label: "Text" },
  ]);
  return `
    ${saved}
    <div class="metric-grid">
      ${renderMetric("Chunks", data.chunk_count ?? chunks.length)}
      ${renderMetric("Document", data.document_id || chunks[0]?.metadata?.document_id || "N/A")}
      ${renderMetric("Revision", data.revision || chunks[0]?.metadata?.revision || "N/A")}
    </div>
    <div class="section"><h3>Clause Chunks</h3>${rows}</div>
  `;
}

function renderDocumentList(data) {
  return `
    <div class="section">
      <h3>Saved Documents</h3>
      ${renderActionTable(data.documents || [], [
        { key: "document_id", label: "Document" },
        { key: "title", label: "Title" },
        { key: "revision", label: "Revision" },
        { key: "asset", label: "Asset" },
        { key: "chunk_count", label: "Chunks" },
        { key: "created_utc", label: "Created" },
      ], "Open", "data-document-id")}
    </div>
  `;
}

function renderChat(data) {
  return `
    ${renderFlags(data.flags)}
    <div class="answer">${escapeHtml(data.answer || "No answer returned.")}</div>
    ${data.tool_results?.length ? `<div class="section"><h3>Tool Results</h3>${renderJson(data.tool_results)}</div>` : ""}
  `;
}

function renderKillSheet(data) {
  const metrics = [
    renderMetric("Kill mud weight", data.kill_mud_weight_ppg, "ppg"),
    renderMetric("ICP", data.initial_circulating_pressure_psi, "psi"),
    renderMetric("FCP", data.final_circulating_pressure_psi, "psi"),
    renderMetric("Surface to bit", data.strokes_surface_to_bit, "strokes"),
    renderMetric("Bit to surface", data.strokes_bit_to_surface, "strokes"),
    renderMetric("MAASP", data.maasp_psi ?? "N/A", data.maasp_psi === null ? "" : "psi"),
  ].join("");

  const schedule = renderRows(data.pressure_schedule || [], [
    { key: "strokes", label: "Strokes" },
    { key: "drill_pipe_pressure_psi", label: "DPP, psi" },
    { key: "note", label: "Note" },
  ]);

  const working = (data.working || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const notes = (data.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("");

  return `
    <div class="alert">${escapeHtml(data.banner)}</div>
    <div class="metric-grid">${metrics}</div>
    <div class="section"><h3>Influx Analysis</h3>${renderJson(data.influx)}</div>
    <div class="section"><h3>Pressure Schedule</h3>${schedule}</div>
    <div class="section"><h3>Working</h3><ol>${working}</ol></div>
    ${notes ? `<div class="section"><h3>Notes</h3><ul>${notes}</ul></div>` : ""}
  `;
}

function renderEmissions(data) {
  const totals = data.inventory?.totals || {};
  const tierStatus = data.ghgemp_report?.tier_status || {};
  const readiness = data.mrv_readiness || {};
  const flags = data.ghgemp_report?.compliance_flags || [];
  const metrics = [
    renderMetric("CO2e", totals.co2e_tonnes ?? "N/A", "tonnes"),
    renderMetric("CH4", totals.ch4_tonnes ?? "N/A", "tonnes"),
    renderMetric("CO2", totals.co2_tonnes ?? "N/A", "tonnes"),
    renderMetric("Tier readiness", tierStatus.tier_readiness_pct ?? "N/A", "%"),
    renderMetric("Tier 2 lines", data.inventory?.tier_summary?.["Tier 2"] ?? 0),
    renderMetric("Tier 3 lines", data.inventory?.tier_summary?.["Tier 3"] ?? 0),
  ].join("");

  const lines = renderRows(data.inventory?.lines || [], [
    { key: "source_id", label: "Source" },
    { key: "source_type", label: "Type" },
    { key: "tier", label: "Tier" },
    { key: "ch4_tonnes", label: "CH4 t" },
    { key: "co2_tonnes", label: "CO2 t" },
    { key: "method", label: "Method" },
  ]);

  const nextActions = (readiness.next_actions || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const priorityGaps = renderRows(readiness.priority_gaps || [], [
    { key: "source_id", label: "Source" },
    { key: "source_type", label: "Type" },
    { key: "current_tier", label: "Current tier" },
  ]);
  const gapActionPlan = renderRows(readiness.gap_action_plan || [], [
    { key: "source_id", label: "Source" },
    { key: "source_type", label: "Type" },
    { key: "current_tier", label: "Current tier" },
    { key: "required_action", label: "Required action" },
    { key: "evidence_required", label: "Evidence required" },
  ]);

  return `
    <div class="readiness ${readiness.status === "ready_for_target_tier" ? "ready" : "action"}">
      <div>
        <span>MRV readiness</span>
        <strong>${escapeHtml(readiness.status || "unknown")}</strong>
      </div>
      <div>
        <span>Gap count</span>
        <strong>${escapeHtml(readiness.gap_count ?? "N/A")}</strong>
      </div>
      <div>
        <span>Audit hash</span>
        <code>${escapeHtml((readiness.audit_sha256 || "").slice(0, 16))}${readiness.audit_sha256 ? "..." : ""}</code>
      </div>
    </div>
    <div class="section saved-record">
      <h3>Saved Inventory</h3>
      <code>${escapeHtml(data.inventory_id || "not saved")}</code>
      ${data.created_utc ? `<span>${escapeHtml(data.created_utc)}</span>` : ""}
    </div>
    ${flags.length ? renderFlags(flags) : ""}
    <div class="metric-grid">${metrics}</div>
    <div class="section"><h3>Next Actions</h3><ol>${nextActions}</ol></div>
    <div class="section"><h3>Priority Tier Gaps</h3>${priorityGaps}</div>
    <div class="section"><h3>Tier 3 Gap Action Plan</h3>${gapActionPlan}</div>
    <div class="section"><h3>Inventory Lines</h3>${lines}</div>
    <div class="section"><h3>GHGEMP Report</h3>${renderJson(data.ghgemp_report)}</div>
  `;
}

function renderMrvList(data) {
  return `
    <div class="section">
      <h3>Saved MRV Inventories</h3>
      ${renderActionTable(data.inventories || [], [
        { key: "facility_id", label: "Facility" },
        { key: "period", label: "Period" },
        { key: "asset", label: "Asset" },
        { key: "status", label: "Status" },
        { key: "tier_readiness_pct", label: "Tier %" },
        { key: "gap_count", label: "Gaps" },
        { key: "created_utc", label: "Created" },
      ], "Open", "data-mrv-id")}
    </div>
  `;
}

function renderSavedMrvRecord(record) {
  const result = {
    ...record.response,
    inventory_id: record.inventory_id,
    created_utc: record.created_utc,
  };
  return renderEmissions(result);
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvValue(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replaceAll('"', '""')}"`;
}

function inventoryCsv(data) {
  const rows = data?.inventory?.lines || [];
  const columns = ["source_id", "source_type", "tier", "ch4_tonnes", "co2_tonnes", "n2o_tonnes", "method"];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((col) => csvValue(row[col])).join(",")),
  ].join("\n");
}

function applyInventorySample(sample) {
  const form = document.querySelector("#emissionsForm");
  form.elements.facility_id.value = sample.facility_id;
  form.elements.period.value = sample.period;
  form.elements.operator.value = sample.operator;
  form.elements.asset.value = sample.asset;
  state.sources = sample.sources.map((source) => ({
    source_id: source.source_id,
    source_type: source.source_type,
    params: JSON.parse(JSON.stringify(source.params)),
  }));
  renderSources();
}

function updateSourceSample() {
  const type = document.querySelector("#sourceType").value;
  const sample = sourceSamples[type];
  document.querySelector("#sourceId").value = sample.sourceId;
  document.querySelector("#sourceParams").value = JSON.stringify(sample.params, null, 2);
}

function renderSources() {
  const list = document.querySelector("#sourceList");
  if (!state.sources.length) {
    list.innerHTML = '<div class="empty">No sources added.</div>';
    return;
  }
  list.innerHTML = state.sources
    .map((source, index) => {
      return `
        <div class="source-item">
          <div><strong>${escapeHtml(source.source_id)}</strong> <code>${escapeHtml(source.source_type)}</code></div>
          <button class="secondary" type="button" data-remove-source="${index}">Remove</button>
        </div>
      `;
    })
    .join("");
}

async function checkHealth() {
  const status = document.querySelector("#healthStatus");
  try {
    const response = await fetch("/health");
    const data = await response.json();
    status.textContent = `${data.status.toUpperCase()} Tier ${data.tier}`;
    status.classList.add("ok");
    status.classList.remove("fail");
  } catch (error) {
    status.textContent = "API offline";
    status.classList.add("fail");
    status.classList.remove("ok");
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((btn) => btn.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`#${tab.dataset.view}`).classList.add("is-active");
  });
});

document.querySelector("#chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const target = document.querySelector("#chatOutput");
  const data = formObject(form);
  setBusy(form, true);
  target.innerHTML = '<div class="empty">Submitting...</div>';
  try {
    const payload = {
      message: data.message,
      module: data.module,
      user_role: data.user_role || null,
      jurisdiction: data.jurisdiction || null,
      asset_context: data.asset_context || null,
      offline_mode: Boolean(data.offline_mode),
    };
    target.innerHTML = renderChat(await postJson("/chat", payload));
  } catch (error) {
    renderError(target, error);
  } finally {
    setBusy(form, false);
  }
});

document.querySelector("#killSheetForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const target = document.querySelector("#killOutput");
  const data = formObject(form);
  setBusy(form, true);
  target.innerHTML = '<div class="empty">Calculating...</div>';
  try {
    const payload = {
      method: data.method,
      tvd_ft: numberFromForm(data, "tvd_ft"),
      md_ft: numberFromForm(data, "md_ft"),
      omw_ppg: numberFromForm(data, "omw_ppg"),
      sidpp_psi: numberFromForm(data, "sidpp_psi"),
      sicp_psi: numberFromForm(data, "sicp_psi"),
      pit_gain_bbl: numberFromForm(data, "pit_gain_bbl"),
      scr_pressure_psi: numberFromForm(data, "scr_pressure_psi"),
      pump_output_bbl_per_stk: numberFromForm(data, "pump_output_bbl_per_stk"),
      drill_string_volume_bbl: numberFromForm(data, "drill_string_volume_bbl"),
      annulus_volume_bit_to_surface_bbl: numberFromForm(data, "annulus_volume_bit_to_surface_bbl"),
      annular_capacity_bbl_per_ft: numberFromForm(data, "annular_capacity_bbl_per_ft"),
      shoe_tvd_ft: numberFromForm(data, "shoe_tvd_ft"),
      max_allowable_mw_ppg: numberFromForm(data, "max_allowable_mw_ppg"),
    };
    target.innerHTML = renderKillSheet(await postJson("/well-control/kill-sheet", payload));
  } catch (error) {
    renderError(target, error);
  } finally {
    setBusy(form, false);
  }
});

document.querySelector("#emissionsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const target = document.querySelector("#emissionsOutput");
  const data = formObject(form);
  setBusy(form, true);
  target.innerHTML = '<div class="empty">Building inventory...</div>';
  try {
    const payload = {
      facility_id: data.facility_id,
      period: data.period,
      operator: data.operator,
      asset: data.asset,
      gwp_set: data.gwp_set,
      target_tier: data.target_tier,
      sources: state.sources,
    };
    state.lastMrvResult = await postJson("/emissions/inventory", payload);
    target.innerHTML = renderEmissions(state.lastMrvResult);
  } catch (error) {
    renderError(target, error);
  } finally {
    setBusy(form, false);
  }
});

document.querySelector("#sourceType").addEventListener("change", updateSourceSample);
document.querySelector("#loadReadySample").addEventListener("click", () => {
  applyInventorySample(inventorySamples.tier3Ready);
});
document.querySelector("#loadGapSample").addEventListener("click", () => {
  applyInventorySample(inventorySamples.transitionGaps);
});
document.querySelector("#sampleSource").addEventListener("click", updateSourceSample);
document.querySelector("#addSource").addEventListener("click", () => {
  const type = document.querySelector("#sourceType").value;
  const sourceId = document.querySelector("#sourceId").value.trim();
  const paramsText = document.querySelector("#sourceParams").value;
  try {
    const params = JSON.parse(paramsText);
    if (!sourceId) throw new Error("source_id is required");
    state.sources.push({ source_id: sourceId, source_type: type, params });
    renderSources();
  } catch (error) {
    renderError(document.querySelector("#emissionsOutput"), error);
  }
});

document.querySelector("#sourceList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-source]");
  if (!button) return;
  state.sources.splice(Number(button.dataset.removeSource), 1);
  renderSources();
});

document.querySelector("#clearChat").addEventListener("click", () => {
  document.querySelector("#chatOutput").innerHTML = '<div class="empty">No response yet.</div>';
});

document.querySelector("#clearKill").addEventListener("click", () => {
  document.querySelector("#killOutput").innerHTML = '<div class="empty">No kill sheet yet.</div>';
});

document.querySelector("#clearEmissions").addEventListener("click", () => {
  state.lastMrvResult = null;
  document.querySelector("#emissionsOutput").innerHTML = '<div class="empty">No inventory yet.</div>';
});

document.querySelector("#loadMrvRecords").addEventListener("click", async () => {
  const target = document.querySelector("#emissionsOutput");
  target.innerHTML = '<div class="empty">Loading saved inventories...</div>';
  try {
    target.innerHTML = renderMrvList(await getJson("/emissions/inventories"));
  } catch (error) {
    renderError(target, error);
  }
});

document.querySelector("#emissionsOutput").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-mrv-id]");
  if (!button) return;
  const target = document.querySelector("#emissionsOutput");
  target.innerHTML = '<div class="empty">Loading saved inventory...</div>';
  try {
    const record = await getJson(`/emissions/inventories/${encodeURIComponent(button.dataset.mrvId)}`);
    state.lastMrvResult = {
      ...record.response,
      inventory_id: record.inventory_id,
      created_utc: record.created_utc,
    };
    target.innerHTML = renderSavedMrvRecord(record);
  } catch (error) {
    renderError(target, error);
  }
});

document.querySelector("#documentFile").addEventListener("change", async (event) => {
  const file = event.currentTarget.files[0];
  if (!file) return;
  if (file.name.toLowerCase().endsWith(".pdf")) {
    renderError(document.querySelector("#documentOutput"), new Error("PDF/OCR extraction is blocked in Phase 1. Use text or Markdown, or approve a PDF/OCR dependency."));
    return;
  }
  const text = await file.text();
  document.querySelector("#documentForm textarea[name='text']").value = text;
  if (!document.querySelector("#documentForm input[name='title']").value.trim()) {
    document.querySelector("#documentForm input[name='title']").value = file.name;
  }
});

document.querySelector("#loadDocSample").addEventListener("click", () => {
  document.querySelector("#documentForm input[name='document_id']").value = "SOP-KICK-001";
  document.querySelector("#documentForm input[name='title']").value = "Kick Detection SOP";
  document.querySelector("#documentForm input[name='revision']").value = "Rev 1";
  document.querySelector("#documentForm input[name='jurisdiction']").value = "Nigeria";
  document.querySelector("#documentForm input[name='asset']").value = "demo asset";
  document.querySelector("#documentForm textarea[name='text']").value = `# 1 Purpose
Detect kicks early and route live well-control events to the competent person.

## 2.1 Flow check
If the flow check is positive, follow the rig shut-in procedure and record SIDPP, SICP and pit gain.

## 2.2 Gas alarm
If a gas alarm occurs, alert the control room and follow site emergency procedures.`;
});

document.querySelector("#previewDocument").addEventListener("click", async () => {
  const form = document.querySelector("#documentForm");
  const target = document.querySelector("#documentOutput");
  const payload = documentPayload();
  setBusy(form, true);
  target.innerHTML = '<div class="empty">Building preview...</div>';
  try {
    target.innerHTML = renderDocumentResult(await postJson("/documents/preview", payload));
  } catch (error) {
    renderError(target, error);
  } finally {
    setBusy(form, false);
  }
});

document.querySelector("#documentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const target = document.querySelector("#documentOutput");
  const payload = documentPayload();
  setBusy(form, true);
  target.innerHTML = '<div class="empty">Saving ingest...</div>';
  try {
    target.innerHTML = renderDocumentResult(await postJson("/documents/ingest", payload));
  } catch (error) {
    renderError(target, error);
  } finally {
    setBusy(form, false);
  }
});

document.querySelector("#clearDocumentOutput").addEventListener("click", () => {
  document.querySelector("#documentOutput").innerHTML = '<div class="empty">No document preview yet.</div>';
});

document.querySelector("#loadDocumentRecords").addEventListener("click", async () => {
  const target = document.querySelector("#documentOutput");
  target.innerHTML = '<div class="empty">Loading saved documents...</div>';
  try {
    target.innerHTML = renderDocumentList(await getJson("/documents"));
  } catch (error) {
    renderError(target, error);
  }
});

document.querySelector("#documentOutput").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-document-id]");
  if (!button) return;
  const target = document.querySelector("#documentOutput");
  target.innerHTML = '<div class="empty">Loading saved document...</div>';
  try {
    target.innerHTML = renderDocumentResult(await getJson(`/documents/${encodeURIComponent(button.dataset.documentId)}`));
  } catch (error) {
    renderError(target, error);
  }
});

document.querySelector("#exportMrvJson").addEventListener("click", () => {
  if (!state.lastMrvResult) return;
  const facility = state.lastMrvResult.inventory?.facility_id || "inventory";
  downloadText(`${facility}-mrv-report.json`, JSON.stringify(state.lastMrvResult, null, 2), "application/json");
});

document.querySelector("#exportMrvCsv").addEventListener("click", () => {
  if (!state.lastMrvResult) return;
  const facility = state.lastMrvResult.inventory?.facility_id || "inventory";
  downloadText(`${facility}-source-inventory.csv`, inventoryCsv(state.lastMrvResult), "text/csv");
});

document.querySelector("#printMrvReport").addEventListener("click", () => {
  if (!state.lastMrvResult) return;
  window.print();
});

updateSourceSample();
state.sources.push({
  source_id: "FL-1",
  source_type: "flaring",
  params: sourceSamples.flaring.params,
});
state.sources.push({
  source_id: "AREA-2",
  source_type: "fugitive_t3",
  params: sourceSamples.fugitive_t3.params,
});
renderSources();
checkHealth();
