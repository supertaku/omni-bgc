"""All names, permissions and locations in this fixture are SYNTHETIC TEST ONLY."""
import hashlib


def bundle(base):
    raw = b'SYNTHETIC OFFICE EVIDENCE AND RIGHTS; NOT ACTUAL COMPANY OR PUBLICATION PERMISSION'
    (base / 'synthetic.txt').write_bytes(raw)
    retained = {'file':'synthetic.txt','sha256':hashlib.sha256(raw).hexdigest()}
    start = '2026-10-14T00:00:00Z'; end = '2027-10-14T00:00:00Z'
    source = {'source_id':'TEST_ONLY_OFFICES','owner':'TEST ONLY','category':'merchant','source_url_or_document':'synthetic.txt',
              'source_kind':'field_survey','data_license':'TEST ONLY fictional grant','redistribution_allowed':'true',
              'images_allowed':'UNKNOWN','menu_text_allowed':'UNKNOWN','attribution_text':'TEST ONLY offices',
              'collection_method':'synthetic fixture','fetched_at_utc':start,'raw_sha256':retained['sha256'],
              'source_version':'test-office-v1','restriction_notes':'SYNTHETIC ONLY','consent_reference':'TEST ONLY',
              'reviewer':'test-reviewer','review_status':'APPROVED','jurisdiction':'TEST ONLY','source_published_at':None,
              'data_extract_version':'test-office-v1','retention_terms':'TEST ONLY','review_timestamp':start}
    policy = {'permitted_use':'data','offline_cache_allowed':'true','policy_evidence':'TEST ONLY fictional permission',
              'retained_permission':retained,'reviewer':'test-reviewer','valid_until':end,'license_obligations_satisfied':1,
              'human_rights_review':1,'parent_engineering_review':1,'user_distribution_authorized':1,'reviewed_at_utc':start}
    evidence = {'key':'proof-v1','locator':'synthetic.txt:office facts','retained_evidence':retained,'observed_at':start,
                'valid_until':end,'reviewer':'test-reviewer','verified_at':start,'verification_method':'field_survey',
                'confidence_reason':'SYNTHETIC ONLY','authoritative':True}
    entities = [{'key':'org','kind':'business','fields':{}}, {'key':'tower','kind':'building','fields':{'zone_id':None}},
                {'key':'site','kind':'place','fields':{'business_id':'org','building_id':'tower','floor_id':None}}]
    values = [('org-name','org','name','Synthetic Organization'),('tower-name','tower','name','Synthetic Tower'),
              ('tower-point','tower','coordinate',{'longitude':121.05,'latitude':14.55,'crs':'EPSG:4326'}),
              ('site-name','site','name','Synthetic Company Office'),('site-cat','site','category','office'),
              ('site-building','site','building','tower'),('site-org','site','office_organization','org'),
              ('site-address','site','office_address','Synthetic Tower, BGC'),('site-district','site','office_district','bgc-core'),
              ('site-presence','site','office_presence','operating'),('site-state','site','office_state','operating'),
              ('site-kind','site','office_location_kind','building_polygon_anchor'),('site-industry','site','office_industry','Synthetic technology'),
              ('site-point','site','coordinate',{'longitude':121.05,'latitude':14.55,'crs':'EPSG:4326'})]
    facts = [{'key':key,'subject':subject,'property':property_,'knowledge':'asserted','value':value,
              'freshness':'current','valid_from':start,'valid_until':end,'evidence':['proof-v1']} for key,subject,property_,value in values]
    return {'format_version':1,'synthetic':True,'source':source,'snapshot':{'source_version':'test-office-v1',
            'data_extract_version':'test-office-v1','raw_sha256':retained['sha256'],'fetched_at_utc':start,
            'source_crs':'EPSG:4326','valid_until':end},'raw':retained,'policies':[policy],'evidence':[evidence],
            'entities':entities,'facts':facts,'place_category':[{'place_id':'site','category_code':'office','fact_id':'site-cat'}]}
