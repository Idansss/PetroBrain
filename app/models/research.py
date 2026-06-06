"""Research Mode request and response schemas."""
from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


ResearchDepth = Literal["quick", "standard", "deep"]
ResearchStatus = Literal[
    "plan_ready",
    "approved",
    "rejected",
    "running",
    "completed",
    "failed",
    "stopped",
]


class ResearchPlanStep(BaseModel):
    id: str
    title: str = Field(min_length=3, max_length=180)
    question: str = Field(min_length=3, max_length=500)
    source_types: list[str] = Field(default_factory=list)
    status: Literal["pending", "running", "completed", "skipped", "failed"] = "pending"


class ResearchPlanRequest(BaseModel):
    query: str = Field(min_length=5, max_length=4000)
    jurisdiction: str | None = Field(default=None, max_length=120)
    asset_context: str | None = Field(default=None, max_length=200)
    project_id: str | None = Field(default=None, max_length=200)
    allowed_source_types: list[str] = Field(
        default_factory=lambda: ["internal_document", "web"]
    )
    allowed_domains: list[str] = Field(default_factory=list, max_length=25)
    internal_documents_allowed: bool = True
    web_search_allowed: bool = True
    connectors_allowed: bool = False
    maximum_research_steps: int = Field(default=5, ge=1, le=12)
    maximum_sources: int = Field(default=12, ge=1, le=30)
    date_from: date | None = None
    date_to: date | None = None
    report_type: str = Field(default="technical_research_brief", max_length=100)
    output_depth: ResearchDepth = "standard"
    citation_required: bool = True
    safety_critical: bool = False
    export_format: Literal["markdown", "text"] = "markdown"

    @field_validator("allowed_domains")
    @classmethod
    def normalize_domains(cls, values: list[str]) -> list[str]:
        out: list[str] = []
        for value in values:
            domain = value.strip().lower()
            domain = domain.removeprefix("https://").removeprefix("http://")
            domain = domain.split("/", 1)[0].removeprefix("www.")
            if domain and domain not in out:
                out.append(domain)
        return out

    @model_validator(mode="after")
    def validate_source_configuration(self):
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be on or before date_to")
        if not self.internal_documents_allowed and not self.web_search_allowed:
            raise ValueError("at least one of internal documents or web search must be enabled")
        if self.connectors_allowed:
            raise ValueError("connectors are not enabled for Research Mode")
        return self


class ResearchPlanDecision(BaseModel):
    action: Literal["approve", "reject"] = "approve"
    plan: list[ResearchPlanStep] | None = None


class ResearchRunRequest(BaseModel):
    research_id: str


class ResearchExportRequest(BaseModel):
    format: Literal["markdown", "text"] = "markdown"


class ResearchSource(BaseModel):
    id: str
    source_type: Literal["internal_document", "web"]
    title: str
    url: str | None = None
    snippet: str = ""
    document_id: str | None = None
    revision: str | None = None
    clause: str | None = None
    reliability: Literal["primary", "high", "medium", "low", "unknown"] = "unknown"
    reliability_reason: str = ""
    freshness: Literal["current", "dated", "unknown"] = "unknown"
    published_at: str | None = None


class ResearchReport(BaseModel):
    title: str
    report_type: str
    executive_summary: str
    sections: list[dict[str, Any]] = Field(default_factory=list)
    key_findings: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    outdated_sources: list[str] = Field(default_factory=list)
    checked: list[str] = Field(default_factory=list)
    not_verified: list[str] = Field(default_factory=list)
    next_actions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: dict[str, str] = Field(default_factory=dict)
    markdown: str


class ResearchRunResponse(BaseModel):
    id: str
    tenant_id: str
    user_id: str
    status: ResearchStatus
    query: str
    config: dict[str, Any]
    plan: list[ResearchPlanStep]
    sources: list[ResearchSource] = Field(default_factory=list)
    report: ResearchReport | None = None
    evidence_pack: dict[str, Any] = Field(default_factory=dict)
    flags: list[str] = Field(default_factory=list)
    error: str | None = None
    created_utc: str
    updated_utc: str


class ResearchListResponse(BaseModel):
    research: list[ResearchRunResponse]
