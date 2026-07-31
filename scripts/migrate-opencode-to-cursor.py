#!/usr/bin/env python3
"""One-shot migration: .opencode/skills -> .cursor/skills with Cursor frontmatter."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_SKILLS = ROOT / ".opencode" / "skills"
DST_SKILLS = ROOT / ".cursor" / "skills"
SRC_GOV = ROOT / ".opencode" / "governance"
DST_GOV = ROOT / "docs" / "governance"

WORKFLOW_PREFIX = "pathguard-workflow-"


def parse_frontmatter(content: str) -> tuple[dict[str, str], str, str]:
    if not content.startswith("---"):
        return {}, content, content
    end = content.find("\n---", 3)
    if end == -1:
        return {}, content, content
    fm_raw = content[3:end].strip()
    body = content[end + 4 :].lstrip("\n")
    fields: dict[str, str] = {}
    current_key: str | None = None
    current_lines: list[str] = []

    for line in fm_raw.splitlines():
        if re.match(r"^[a-zA-Z0-9_-]+:\s*", line) and not line.startswith("  "):
            if current_key is not None:
                fields[current_key] = "\n".join(current_lines).strip()
            key, _, value = line.partition(":")
            current_key = key.strip()
            current_lines = [value.strip()] if value.strip() else []
        elif current_key is not None:
            current_lines.append(line)

    if current_key is not None:
        fields[current_key] = "\n".join(current_lines).strip()

    return fields, fm_raw, body


def extract_metadata_block(fm_raw: str) -> tuple[str, list[str], list[str]]:
    triggers: list[str] = []
    prerequisites: list[str] = []
    if "metadata:" not in fm_raw:
        return fm_raw, triggers, prerequisites

    lines = fm_raw.splitlines()
    out: list[str] = []
    i = 0
    current_list: str | None = None
    while i < len(lines):
        line = lines[i]
        if line.strip() == "metadata:":
            i += 1
            continue
        if line.startswith("  triggers:"):
            current_list = "triggers"
            i += 1
            continue
        if line.startswith("  prerequisites:"):
            current_list = "prerequisites"
            i += 1
            continue
        if line.startswith("  agent_owner:") or line.startswith("  "):
            item_match = re.match(r"^\s+-\s+(.+)$", line)
            if item_match and current_list == "triggers":
                triggers.append(item_match.group(1).strip())
                i += 1
                continue
            if item_match and current_list == "prerequisites":
                prerequisites.append(item_match.group(1).strip())
                i += 1
                continue
        if re.match(r"^[a-zA-Z0-9_-]+:\s*", line) and not line.startswith("  "):
            current_list = None
            out.append(line)
            i += 1
            continue
        if not line.startswith("  "):
            out.append(line)
        i += 1

    cleaned = "\n".join(out).strip()
    return cleaned, triggers, prerequisites


def normalize_description(description: str, triggers: list[str]) -> str:
    desc = re.sub(r"\s*\|\s*", " ", description)
    desc = re.sub(r"\s+", " ", desc).strip()
    if triggers:
        trigger_text = "; ".join(triggers[:6])
        if len(triggers) > 6:
            trigger_text += "; ..."
        desc = f"{desc} Use when: {trigger_text}."
    return desc


def build_frontmatter(name: str, description: str, workflow: bool) -> str:
    lines = ["---", f"name: {name}", f"description: >-", f"  {description}"]
    if workflow:
        lines.append("disable-model-invocation: true")
    lines.append("---")
    return "\n".join(lines)


def prerequisites_section(prerequisites: list[str]) -> str:
    if not prerequisites:
        return ""
    items = "\n".join(f"- `{p}`" for p in prerequisites)
    return f"\n## Prerequisites\n\nRead these skills first:\n{items}\n"


def migrate_skill(src: Path, dst: Path) -> None:
    content = src.read_text(encoding="utf-8")
    fields, fm_raw, body = parse_frontmatter(content)
    name = fields.get("name", src.parent.name)
    description = fields.get("description", "").strip()
    _, triggers, prerequisites = extract_metadata_block(fm_raw)

    body = body.replace(".opencode/skills/", ".cursor/skills/")
    body = body.replace(".opencode/governance/", "docs/governance/")
    prereq_block = prerequisites_section(prerequisites)
    if prereq_block and "## Prerequisites" not in body:
        title_end = body.find("\n\n", body.find("#"))
        if title_end != -1:
            body = body[: title_end + 2] + prereq_block.lstrip("\n") + "\n" + body[title_end + 2 :]
        else:
            body = prereq_block + "\n" + body

    normalized_desc = normalize_description(description, triggers)
    workflow = name.startswith(WORKFLOW_PREFIX)
    new_content = build_frontmatter(name, normalized_desc, workflow) + "\n\n" + body
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(new_content, encoding="utf-8")


def migrate_archive_md(src: Path, dst: Path) -> None:
    content = src.read_text(encoding="utf-8")
    content = content.replace(".opencode/skills/", ".cursor/skills/")
    content = content.replace(".opencode/governance/", "docs/governance/")
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(content, encoding="utf-8")


def main() -> None:
    if not SRC_SKILLS.is_dir():
        raise SystemExit(f"Missing source skills dir: {SRC_SKILLS}")

    if DST_SKILLS.exists():
        shutil.rmtree(DST_SKILLS)
    DST_SKILLS.mkdir(parents=True)

    for skill_dir in sorted(SRC_SKILLS.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_file = skill_dir / "SKILL.md"
        if skill_file.is_file():
            migrate_skill(skill_file, DST_SKILLS / skill_dir.name / "SKILL.md")

    archive_src = SRC_SKILLS / "archive"
    if archive_src.is_dir():
        archive_dst = DST_SKILLS / "archive"
        archive_dst.mkdir(parents=True, exist_ok=True)
        for md in sorted(archive_src.glob("*.md")):
            migrate_archive_md(md, archive_dst / md.name)

    if SRC_GOV.is_dir():
        if DST_GOV.exists():
            shutil.rmtree(DST_GOV)
        shutil.copytree(SRC_GOV, DST_GOV)
        for md in DST_GOV.glob("*.md"):
            text = md.read_text(encoding="utf-8")
            text = text.replace(".opencode/skills/", ".cursor/skills/")
            text = text.replace(".opencode/governance/", "docs/governance/")
            md.write_text(text, encoding="utf-8")

    print(f"Migrated skills -> {DST_SKILLS}")
    print(f"Migrated governance -> {DST_GOV}")


if __name__ == "__main__":
    main()
