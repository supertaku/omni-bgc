"""Portable exact-byte evidence checks; no parser, permissions, or acquisition."""
import hashlib
import json
from pathlib import Path


def validate_bound_evidence(approval, paths, expected_raw_sha256):
    if (approval.get('parent_decision') != 'ACCEPT' or
            approval.get('distribution_authorized') is not False or
            approval.get('human_rights_review') is not False):
        raise ValueError('internal_only_parent_ACCEPT_required')
    for key, path in paths.items():
        digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        if approval.get(key) != digest:
            raise ValueError('changed_accepted_bytes:' + key)
    if approval['raw_sha256'] != expected_raw_sha256:
        raise ValueError('raw_not_exact_allowlist_snapshot')
    meta = json.loads(Path(paths['sidecar_sha256']).read_text(encoding='utf-8'))
    if hashlib.sha256(meta['query'].encode('utf-8')).hexdigest() != approval['query_sha256']:
        raise ValueError('changed_query_or_prior_boundary_metadata')
    return json.loads(Path(paths['intake_review_sha256']).read_text(encoding='utf-8'))
