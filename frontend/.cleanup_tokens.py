#!/usr/bin/env python3
"""Second-pass cleanup for leftover tokens and size reduction."""
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

REPLACEMENTS = [
    # leftover academic tokens
    ("bg-academic-outline-variant", "bg-app-bg-subtle"),
    ("text-academic-outline-variant", "text-slate-400"),
    # typography
    ("tracking-tight", ""),
    # size reduction on headings only (manual targeted strings will be handled separately)
]

# Regex cleanup
RX_REMOVE = [
    re.compile(r"\bshadow-academic-sm\b"),
    re.compile(r"\bshadow-academic-lg\b"),
    re.compile(r"\bshadow-academic\b"),
    # stray hover: without a following utility
    re.compile(r"\bhover:\s+"),
    # stray -sm / -lg shadow leftovers at end of class strings
    re.compile(r"\s+-sm\b"),
    re.compile(r"\s+-lg\b"),
]


def clean(text: str) -> str:
    for old, new in REPLACEMENTS:
        if old:
            text = text.replace(old, new)
    for rx in RX_REMOVE:
        text = rx.sub("", text)
    # collapse whitespace inside className strings
    def repl(m: re.Match) -> str:
        quote = m.group(1)
        classes = " ".join(m.group(2).split())
        return f"className={quote}{classes}{quote}"
    text = re.sub(r'className=("{0,2})([^"]*?)\1', repl, text)
    return text


def main() -> None:
    for rel in FILES:
        path = ROOT / rel
        original = path.read_text(encoding="utf-8")
        updated = clean(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            print(f"cleaned {rel}")
        else:
            print(f"unchanged {rel}")


if __name__ == "__main__":
    main()
