"""Evidence-linked document spans; no embeddings, model calls or acquisition.

Only invoke after separate permission review permits storing source text.
Offsets count Unicode code points, not UTF-8 bytes or JavaScript UTF-16 units.
"""
from __future__ import annotations
import hashlib
import uuid
from dataclasses import dataclass

@dataclass(frozen=True)
class Section:
    key: str
    heading: str
    start: int
    end: int
    parent_key: str | None = None

@dataclass(frozen=True)
class Passage:
    id: str
    document_id: str
    section_key: str
    start: int
    end: int
    body: str
    content_sha256: str
    citation_id: str

def passages(document_id: str, text: str, sections: list[Section], max_chars: int = 1200) -> list[Passage]:
    """Prefer the deepest section while retaining uncovered parent text.

    Stable passage identity binds immutable document UUID, section and exact span
    hash. Revised text requires a new document UUID; do not overwrite it.
    """
    namespace = uuid.UUID(document_id)
    if not isinstance(text,str) or not 80<=max_chars<=10000:
        raise ValueError("text and bounded passage size required")
    by_key = {s.key:s for s in sections}
    if len(by_key)!=len(sections):
        raise ValueError("duplicate section key")
    for s in sections:
        if not s.key or not s.heading.strip() or not 0<=s.start<s.end<=len(text):
            raise ValueError("invalid section span")
        path = {s.key}
        parent = s.parent_key
        while parent is not None:
            if parent in path or parent not in by_key:
                raise ValueError("missing/cyclic section parent")
            path.add(parent)
            p = by_key[parent]
            if not p.start<=s.start<s.end<=p.end:
                raise ValueError("section outside ancestor")
            parent = p.parent_key
    def ancestors(s):
        result = []
        parent = s.parent_key
        while parent is not None:
            result.append(parent)
            parent = by_key[parent].parent_key
        return result
    for i,left in enumerate(sections):
        for right in sections[i+1:]:
            if max(left.start,right.start)<min(left.end,right.end) and left.key not in ancestors(right) and right.key not in ancestors(left):
                raise ValueError("overlapping sibling sections")
    boundaries = sorted({x for s in sections for x in (s.start,s.end)})
    spans = []
    for start,end in zip(boundaries,boundaries[1:]):
        matches = [s for s in sections if s.start<=start<end<=s.end]
        if not matches:
            continue
        s = max(matches,key=lambda s:len(ancestors(s)))
        if spans and spans[-1][0].key==s.key and spans[-1][2]==start:
            spans[-1] = (s,spans[-1][1],end)
        else:
            spans.append((s,start,end))
    result = []
    for s,start,span_end in spans:
        while start<span_end:
            end = min(start+max_chars,span_end)
            if end<span_end:
                window = text[start:end]
                boundary = window.rfind("\n\n")
                if boundary<max_chars//3:
                    boundary = window.rfind(". ")
                if boundary<max_chars//3:
                    boundary = window.rfind(" ")
                if boundary>=max_chars//3:
                    end = start+boundary+1
            body = text[start:end]
            digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
            ident = str(uuid.uuid5(namespace,f"{s.key}:{start}:{end}:{digest}"))
            result.append(Passage(ident,str(namespace),s.key,start,end,body,digest,f"omni:passage:{ident}"))
            start = end
    return result
