#!/usr/bin/env python3
"""Token migration script for frontend/src/student visual redesign."""
import re
from pathlib import Path

ROOT = Path("/home/dit/DockUS_v4/DockUS/frontend/src/student")

FILES = [
    "StudentWorkspacePanel.tsx",
    "StudentHomeSection.tsx",
    "StudentDeliveriesSection.tsx",
    "StudentAssignmentsSection.tsx",
    "StudentReportsSection.tsx",
    "StudentSubmissionFlow.tsx",
    "EvaluationNotificationBanner.tsx",
    "PipelineStepper.tsx",
    "SubmissionCoachingPreview.tsx",
    "components/EvaluationProgressCard.tsx",
    "components/FileTreePreview.tsx",
    "components/StudentWorkspaceSurface.tsx",
    "components/SubmissionEmptyState.tsx",
    "components/SubmissionSidebar.tsx",
    "components/SubmissionStep1.tsx",
    "components/SubmissionStep2.tsx",
    "components/SubmissionStep3.tsx",
    "components/SubmissionStepIndicator.tsx",
    "components/SubmissionSuccess.tsx",
]

# Longer / more specific tokens first so partial replacements don't leak.
REPLACEMENTS = [
    # Exact compound colors
    ("text-brand-blue-dark", "text-primary"),
    ("bg-brand-blue-dark", "bg-primary"),
    ("border-brand-blue-dark", "border-primary"),
    # Academic colors
    ("text-academic-on-surface-variant", "text-slate-500"),
    ("text-academic-on-surface", "text-slate-900"),
    ("text-academic-outline-variant", "text-slate-400"),
    ("text-academic-outline", "text-slate-400"),
    ("text-academic-secondary", "text-slate-600"),
    ("text-academic-tertiary", "text-accent"),
    ("text-academic-primary", "text-primary"),
    ("bg-academic-surface-container-lowest", "bg-slate-50"),
    ("bg-academic-surface-container-low", "bg-slate-50"),
    ("bg-academic-surface-container", "bg-slate-50"),
    ("bg-academic-surface-variant", "bg-app-bg-subtle"),
    ("bg-academic-surface", "bg-app-bg"),
    ("bg-academic-primary", "bg-primary"),
    ("bg-academic-secondary", "bg-slate-100"),
    ("bg-academic-tertiary", "bg-accent"),
    ("border-academic-outline-variant", "border-app-border"),
    ("border-academic-outline", "border-slate-300"),
    ("border-academic-surface-variant", "border-app-border"),
    ("border-academic-surface", "border-app-bg"),
    ("border-academic-primary", "border-primary"),
    # Brand colors
    ("text-brand-blue", "text-primary"),
    ("bg-brand-blue", "bg-primary"),
    ("border-brand-blue", "border-primary"),
    ("text-brand-maroon", "text-accent"),
    ("bg-brand-maroon", "bg-accent"),
    ("border-brand-maroon", "border-accent"),
    ("text-brand-gold", "text-amber-500"),
    ("bg-brand-gold", "bg-amber-100"),
    ("border-brand-gold", "border-amber-200"),
    ("bg-brand-cream", "bg-amber-50"),
    # Typography
    ("font-display", ""),
    # Shadows
    ("shadow-academic-lg", ""),
    ("shadow-academic", ""),
    ("shadow-academic-sm", ""),
    ("shadow-2xl", ""),
    ("shadow-xl", ""),
    # Radius
    ("rounded-[2rem]", "rounded-lg"),
    ("rounded-[1.75rem]", "rounded-lg"),
    ("rounded-[1.5rem]", "rounded-lg"),
    ("rounded-[3rem]", "rounded-xl"),
    ("rounded-3xl", "rounded-xl"),
    ("rounded-2xl", "rounded-lg"),
    # Hover transforms
    ("hover:-translate-y-1", ""),
    ("hover:-translate-y-0.5", ""),
    # Excessive tracking
    ("tracking-[0.16em]", ""),
    ("tracking-[0.14em]", ""),
    ("font-black", "font-semibold"),
]

# Regex replacements (whole tokens)
RE_REMOVE = [
    re.compile(r"\banimate-in\b"),
    re.compile(r"\bfade-in\b"),
    re.compile(r"\bzoom-in-95\b"),
    re.compile(r"\bslide-in-from-top-4\b"),
    re.compile(r"\bslide-in-from-top-2\b"),
    re.compile(r"\bduration-700\b"),
    re.compile(r"\bbg-gradient-to-br\b"),
    re.compile(r"\b(from|via|to)-[^\s]+\b"),
]


def migrate(text: str) -> str:
    for old, new in REPLACEMENTS:
        if old:
            text = text.replace(old, new)
    for rx in RE_REMOVE:
        text = rx.sub("", text)
    # Clean leftover double spaces inside className attributes only
    def clean_classname(m: re.Match) -> str:
        quote = m.group(1)
        classes = m.group(2)
        # remove leading/trailing spaces and collapse
        classes = " ".join(classes.split())
        return f"className={quote}{classes}{quote}"
    text = re.sub(r'className=("{0,2})([^"]*?)\1', clean_classname, text)
    return text


def main() -> None:
    for rel in FILES:
        path = ROOT / rel
        original = path.read_text(encoding="utf-8")
        updated = migrate(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            print(f"updated {rel}")
        else:
            print(f"unchanged {rel}")


if __name__ == "__main__":
    main()
