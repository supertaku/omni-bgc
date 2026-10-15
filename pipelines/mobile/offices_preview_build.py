"""Host-only isolated Offices ARM64 preview. No ADB or device commands.

Reuse the reviewed GEX native packaging workflow without changing its staging or
main native project. The private preview enables the explicit candidate-view
toggle in its staged copy only. No candidate becomes an approved Places record.
"""
import argparse
import importlib.util
from pathlib import Path
import shutil
from zipfile import ZipFile

ROOT=Path(__file__).resolve().parents[2]
retained_helper=ROOT/'.g/of-host-helper/build-workflow.py'
spec=importlib.util.spec_from_file_location('office_host_packaging',retained_helper if retained_helper.exists() else ROOT/'pipelines/mobile/gex_preview_build.py')
workflow=importlib.util.module_from_spec(spec);spec.loader.exec_module(workflow)
workflow.PACKAGE='com.omnibgc.officespreview'
original_configure=workflow.configure_staging


def configure(stage):
    original_configure(stage)
    mobile=stage/'apps/mobile'
    config=workflow.load(mobile/'app.json')
    config['expo']['name']='Omni-BGC Offices Preview'
    config['expo']['scheme']='omni-bgc-offices-preview'
    workflow.dump(mobile/'app.json',config)
    research=mobile/'src/features/offices/research.ts'
    source=research.read_text(encoding='utf-8')
    expected="export const internalOfficeResearchEnabled = typeof __DEV__ !== 'undefined' && __DEV__;"
    workflow.require(source.count(expected)==1,'Reviewed internal office gate changed')
    source=source.replace(expected,'// INTERNAL PREVIEW ONLY: explicit research toggle; no approved entities.\nexport const internalOfficeResearchEnabled = true;')
    research.write_text(source,encoding='utf-8',newline='\n')


workflow.configure_staging=configure


def private(name):
    path=(ROOT/'.g'/name).resolve()
    workflow.require(path.parent==(ROOT/'.g').resolve() and path.name.startswith('of-'),'Only direct .g/of-* paths allowed')
    return path


def verify(stage,cache,build_home):
    workflow.verify(stage,cache,build_home)
    receipt=workflow.load(stage/'apk-verification.json')
    original=Path(receipt['apk']['path']);target=stage/'Omni-BGC-Offices-preview-arm64.apk'
    if original!=target:
        workflow.require(not target.exists(),'Immutable Offices preview already exists')
        original.rename(target)
    receipt['apk']['path']=str(target)
    mapping=workflow.load(Path(receipt['source_map']['path']))
    checked={}
    for suffix in ['src/features/offices/OfficeDirectory.tsx','src/features/offices/OfficeDetails.tsx','src/features/offices/service.ts','src/features/offices/assistant.ts','src/features/offices/research.ts','src/data/offices.ts','src/data/office-store.ts','src/data/office-projection.ts','src/features/explore/directory.ts','src/app/Application.tsx','src/map/presentation.ts']:
        matches=[content for source,content in zip(mapping['sources'],mapping['sourcesContent']) if source.replace('\\','/').endswith(suffix)]
        file=stage/'apps/mobile'/suffix
        workflow.require(len(matches)==1 and matches[0]==file.read_text(encoding='utf-8'),'Exact office source/asset missing from embedded source map: '+suffix)
        checked[suffix]=workflow.sha(file)
    research=workflow.load(stage/'apps/mobile/assets/generated/offices/research.json')
    workflow.require(research['publicationAuthorized'] is False and research['mapPoints']==0 and len(research['candidates'])==179,'Internal seed research-only contract changed')
    with ZipFile(target) as archive:
        bundle=archive.read('assets/index.android.bundle')
    workflow.require(all(row['candidateId'].encode('utf-8') in bundle for row in research['candidates']),'Embedded candidate ID inventory differs from exact retained input')
    receipt.update(office_sources=checked,office_research_candidates=179,office_canonical_approvals=0,
                   office_research_asset_sha256=workflow.sha(stage/'apps/mobile/assets/generated/offices/research.json'),
                   embedded_research_candidate_ids_verified=179,
                   office_build_workflow_sha256=workflow.sha(Path(__file__)),
                   shared_checkout_note='Frozen current Offices + GEX composition; private staged research-view gate enabled for this separate internal preview only. No app or source distribution authorization.')
    workflow.dump(stage/'apk-verification.json',receipt)


def revise(stage, javascript_only=False):
    """Preserve a verified intermediate before an explicitly requested source revision."""
    receipt=workflow.load(stage/'apk-verification.json')
    workflow.require(receipt['apk']['package']==workflow.PACKAGE and receipt['physical_device_tested'] is False,'Only uninstalled intermediate Offices builds may be revised')
    revision=1
    while (stage/f'history/revision-{revision}').exists():revision+=1
    history=(stage/f'history/revision-{revision}').resolve()
    workflow.require(history.is_relative_to(stage.resolve()) and not history.exists(),'Immutable intermediate history already exists')
    history.mkdir(parents=True)
    for name in ['source-receipt.json','apk-verification.json','staged-source-snapshot.zip','assemble-release.log','prebuild.log','isolated-build.init.gradle','Omni-BGC-Offices-preview-arm64.apk']:
        source=stage/name
        workflow.require(source.is_file(),'Intermediate evidence missing: '+name)
        shutil.copyfile(source,history/name)
    # Both explicitly resolved targets stay in this owned staging directory.
    for name in ['assemble-release.log','Omni-BGC-Offices-preview-arm64.apk']:
        target=(stage/name).resolve()
        workflow.require(target.parent==stage.resolve(),'Refuse a staging escape')
        target.unlink()
    if javascript_only:
        # Preserve CNG/native project and Gradle state; only authored JS/TS changes.
        workflow.source_unchanged(stage)
        shutil.copytree(ROOT/'apps/mobile/src',stage/'apps/mobile/src',dirs_exist_ok=True)
        research=stage/'apps/mobile/src/features/offices/research.ts'
        source=research.read_text(encoding='utf-8')
        expected="export const internalOfficeResearchEnabled = typeof __DEV__ !== 'undefined' && __DEV__;"
        workflow.require(source.count(expected)==1,'Reviewed research gate changed')
        research.write_text(source.replace(expected,'// INTERNAL PREVIEW ONLY: explicit research toggle; no approved entities.\nexport const internalOfficeResearchEnabled = true;'),encoding='utf-8',newline='\n')
        old=workflow.load(stage/'source-receipt.json')
        current_sources={row['path']:row for row in workflow.source_files() if row['path'].startswith('apps/mobile/src/')}
        old['sources']=[current_sources.get(row['path'],row) for row in old['sources']]
        old['staged_sources']=workflow.staged_records(stage,old['sources'])
        workflow.dump(stage/'source-receipt.json',old)
    else:
        workflow.refresh(stage)
    current=workflow.load(stage/'source-receipt.json')
    current['previous_verified_intermediate']={'path':str(history),'receipt_sha256':workflow.sha(history/'apk-verification.json')}
    workflow.dump(stage/'source-receipt.json',current)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',default='of-r1');parser.add_argument('--cache',default='of-c');parser.add_argument('--build-home',default='of-b')
    parser.add_argument('--phase',choices=['prepare','refresh','revise','revise-js','prebuild','build','verify','all'],default='all')
    args=parser.parse_args();stage=private(args.stage);cache=private(args.cache);build_home=private(args.build_home)
    if args.phase=='refresh':workflow.refresh(stage)
    if args.phase=='revise':revise(stage)
    if args.phase=='revise-js':revise(stage,True)
    for phase,callback in [('prepare',lambda:workflow.prepare(stage,cache,build_home)),('prebuild',lambda:workflow.prebuild(stage,cache)),('build',lambda:workflow.build(stage,cache)),('verify',lambda:verify(stage,cache,build_home))]:
        if args.phase in {phase,'all'}:callback()


if __name__=='__main__':main()
