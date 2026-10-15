"""Fictional pack bytes/receipts; never a release trust grant or bundled asset."""
import copy
from contextlib import closing
import json
import sqlite3
import unittest
import test_publication as publication
import pack
NOW = publication.NOW


class OfficePackTests(unittest.TestCase):
    setUp = publication.OfficePublicationTests.setUp
    tearDown = publication.OfficePublicationTests.tearDown
    ingest_and_approve = publication.OfficePublicationTests.ingest_and_approve
    export_office = publication.OfficePublicationTests.export_office
    def make_artifacts(self):
        self.ingest_and_approve()
        mobile,_ = self.export_office()
        mobile.executescript((pack.ROOT/'packages/database/migrations/mobile/003_read_projection.up.sql').read_text())
        mobile.execute("INSERT INTO pack_metadata VALUES('build_contract','m4-local-content-v1')")
        mobile.execute("INSERT INTO pack_metadata VALUES('synthetic_test_only','false')")
        mobile.commit()
        base=self.base/'base'; office=self.base/'office'; base.mkdir(); office.mkdir()
        target=sqlite3.connect(base/'main.sqlite'); mobile.backup(target); target.close()
        raw=(base/'main.sqlite').read_bytes(); (office/'main.sqlite').write_bytes(raw)
        snapshot=mobile.execute('SELECT id,raw_sha256,license,attribution,valid_until FROM source_snapshot').fetchone()
        snapshot=dict(zip(['id','rawSha256','license','attribution','validUntil'],snapshot))
        snapshot.update(permissionEvidenceSha256=self.bundle['raw']['sha256'],permittedUse='data')
        manifest={'formatVersion':1,'kind':'places','schemaVersion':3,'scopeId':'omni-bgc:service-area:high-street-pilot-v1','version':'TEST-base',
                  'createdAt':NOW,'validUntil':'2027-10-14T00:00:00Z','dependencies':[],'snapshots':[snapshot],
                  'files':[{'path':'main.sqlite','url':'https://example.invalid/main.sqlite','sha256':pack.digest(raw),'sizeBytes':len(raw)}], 'review':{}}
        (base/'manifest.json').write_bytes(pack.encode(manifest))
        proof={'synthetic_test_only':False,'publication_authorized':False,'dataset_sha256':pack.digest(raw),'size_bytes':len(raw),
               'snapshots':[{'id':snapshot['id'],'raw_sha256':snapshot['rawSha256'],'license':snapshot['license'],'attribution':snapshot['attribution'],
                             'valid_until':snapshot['validUntil'],'retained_evidence':{'permission_evidence':[{'use':'data','sha256':self.bundle['raw']['sha256'],'valid_until':snapshot['validUntil']}]}}]}
        (office/'export-manifest.json').write_bytes(pack.encode(proof))
        return base,office,proof

    def test_prepare_preserves_base_bytes_and_never_grants_mobile_trust(self):
        base,office,_ = self.make_artifacts(); output=self.base/'candidate'
        result=pack.prepare(base,office,output,'TEST-only-office-v1','https://example.invalid/test-only',NOW)
        self.assertFalse(result['publication_authorized']); self.assertFalse((output/'manifest.json').exists())
        self.assertEqual((base/'main.sqlite').read_bytes(),(output/'main.sqlite').read_bytes())
        draft=json.loads((output/'manifest-draft.json').read_bytes())
        self.assertEqual([f['path'] for f in draft['files']],['main.sqlite','office-directory.sqlite'])
        self.assertFalse(draft['review']['userDistributionAuthorized'])
        receipt={**draft['review'],'draft_sha256':result['draft_sha256'],'parentReviewer':'TEST ONLY','humanRightsReviewer':'TEST ONLY','reviewedAt':NOW,'userDistributionAuthorized':True,'licenseObligationsSatisfied':True}
        finalized=pack.finalize(output,receipt,NOW)
        self.assertFalse(finalized['published']); self.assertTrue(finalized['independent_app_trust_registry_review_required'])
        with self.assertRaises(ValueError): pack.finalize(output,receipt,NOW)

    def test_synthetic_corrupt_and_unbound_snapshots_rejected(self):
        base,office,proof = self.make_artifacts()
        changed=copy.deepcopy(proof);changed['synthetic_test_only']=True
        (office/'export-manifest.json').write_bytes(pack.encode(changed))
        with self.assertRaisesRegex(ValueError,'non-synthetic'): pack.prepare(base,office,self.base/'synthetic','TEST-v2','https://example.invalid',NOW)
        (office/'export-manifest.json').write_bytes(pack.encode(proof))
        (office/'main.sqlite').write_bytes(b'corrupted')
        with self.assertRaises(ValueError): pack.prepare(base,office,self.base/'corrupt','TEST-v2','https://example.invalid',NOW)

    def test_review_receipt_must_bind_exact_draft_and_inventory(self):
        base,office,_=self.make_artifacts();out=self.base/'proposal'
        proposal=pack.prepare(base,office,out,'TEST-v2','https://example.invalid',NOW)
        receipt={'draft_sha256':'0'*64}
        with self.assertRaises(ValueError): pack.finalize(out,receipt,NOW)
        receipt.update(draft_sha256=proposal['draft_sha256'],parentReviewer='TEST ONLY',humanRightsReviewer='TEST ONLY',reviewedAt=NOW,userDistributionAuthorized=True,licenseObligationsSatisfied=True)
        (out/'office-directory.sqlite').write_bytes(b'corrupt')
        with self.assertRaisesRegex(ValueError,'checksum'): pack.finalize(out,receipt,NOW)

    def test_permission_expiry_caps_pack_even_when_fact_snapshot_last_longer(self):
        base,office,proof=self.make_artifacts()
        # Distinct geographic snapshot; only the companion permission expires early.
        manifest=json.loads((base/'manifest.json').read_bytes())
        old=manifest['snapshots'][0]['id'];new='00000000-0000-4000-8000-000000000099'
        with closing(sqlite3.connect(base/'main.sqlite')) as db:
            row=list(db.execute('SELECT * FROM source_snapshot WHERE id=?',(old,)).fetchone());row[0]=new
            db.execute('INSERT INTO source_snapshot VALUES(?,?,?,?,?,?,?,?,?)',row)
            db.execute('UPDATE fact_lineage SET snapshot_id=? WHERE snapshot_id=?',(new,old));db.execute('DELETE FROM source_snapshot WHERE id=?',(old,))
            db.commit()
        manifest['snapshots'][0]['id']=new
        raw=(base/'main.sqlite').read_bytes();manifest['files'][0].update(sha256=pack.digest(raw),sizeBytes=len(raw))
        (base/'manifest.json').write_bytes(pack.encode(manifest))
        proof['snapshots'][0]['retained_evidence']['permission_evidence'][0]['valid_until']='2026-11-15T00:00:00Z'
        (office/'export-manifest.json').write_bytes(pack.encode(proof))
        out=self.base/'policy-expiry';pack.prepare(base,office,out,'TEST-expiry','https://example.invalid',NOW)
        draft=json.loads((out/'manifest-draft.json').read_bytes())
        self.assertEqual(draft['validUntil'],'2026-11-15T00:00:00Z')
