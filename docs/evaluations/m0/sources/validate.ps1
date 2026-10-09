param([string]$OutputPath = (Join-Path $PSScriptRoot 'validation.json'))

$ErrorActionPreference = 'Stop'
$taskFolder = $PSScriptRoot
$sharedRegister = Join-Path $taskFolder '../../../data-source-register/source-register.csv'
$inventoryPath = Join-Path $taskFolder 'source-inventory.csv'
$baselineHeader = (Get-Content -LiteralPath $sharedRegister -TotalCount 1)
$candidateHeader = (Get-Content -LiteralPath $inventoryPath -TotalCount 1)
if ($baselineHeader -cne $candidateHeader) { throw 'Source register header mismatch' }
$records = @(Import-Csv -LiteralPath $inventoryPath)
$duplicateIds = @($records | Group-Object source_id | Where-Object Count -gt 1)
$canonicalUrls = @($records | ForEach-Object {
    $sourceUri = [uri]$_.source_url_or_document
    '{0}://{1}{2}{3}' -f $sourceUri.Scheme.ToLowerInvariant(), $sourceUri.Host.ToLowerInvariant(), $sourceUri.AbsolutePath.TrimEnd('/'), $sourceUri.Query
})
$duplicateUrls = @($canonicalUrls | Group-Object | Where-Object Count -gt 1)
if ($duplicateIds.Count -or $duplicateUrls.Count) { throw 'Duplicate source ID or URL' }
if (@($records | Where-Object raw_sha256).Count) { throw 'Unexpected raw dataset hash without acquired raw data' }
if (@($records | Where-Object { $_.review_status -notin @('CANDIDATE','RESEARCH_ONLY') }).Count) { throw 'Unexpected approved or unsupported status' }
$unknownSamples = @('M0-SRC-007','M0-SRC-010','M0-SRC-011')
foreach ($sourceId in $unknownSamples) {
    $row = $records | Where-Object source_id -eq $sourceId
    if ($row.redistribution_allowed -ne 'UNKNOWN' -or $row.images_allowed -ne 'UNKNOWN' -or $row.menu_text_allowed -ne 'UNKNOWN' -or $row.review_status -ne 'CANDIDATE') { throw "Unknown-permission negative case failed: $sourceId" }
}
$rasterRow = $records | Where-Object source_id -eq 'M0-SRC-005'
if ($rasterRow.redistribution_allowed -ne 'false' -or $rasterRow.review_status -ne 'RESEARCH_ONLY') { throw 'Raster offline exclusion failed' }
$failureRow = $records | Where-Object source_id -eq 'M0-SRC-009'
if ($failureRow.restriction_notes -notmatch 'Internal Error' -or $failureRow.redistribution_allowed -ne 'UNKNOWN') { throw 'Failed retrieval uncertainty lost' }
$assets = @(Import-Csv -LiteralPath (Join-Path $taskFolder 'local-concept-assets.csv'))
foreach ($asset in $assets) {
    if ((Get-FileHash -LiteralPath $asset.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $asset.sha256) { throw 'Concept asset hash mismatch' }
}
$validationResult = [ordered]@{
    checked_at_utc = (Get-Date).ToUniversalTime().ToString('o')
    powershell_version = $PSVersionTable.PSVersion.ToString()
    header_exact_match = $true
    column_count = $baselineHeader.Split(',').Count
    source_record_count = $records.Count
    candidate_count = @($records | Where-Object review_status -eq 'CANDIDATE').Count
    policy_research_count = @($records | Where-Object review_status -eq 'RESEARCH_ONLY').Count
    approved_count = 0
    raw_datasets_acquired = 0
    raw_hash_count = @($records | Where-Object raw_sha256).Count
    duplicate_id_count = $duplicateIds.Count
    duplicate_canonical_url_count = $duplicateUrls.Count
    rejected_duplicate_candidates = 0
    redistribution_unknown_count = @($records | Where-Object redistribution_allowed -eq 'UNKNOWN').Count
    concept_asset_count = $assets.Count
    concept_hashes_match = $true
    unknown_permission_samples = $unknownSamples
    menu_and_transit_distribution_blocked = $true
    raster_offline_source_excluded = $true
    failed_retrieval_remains_unverified = $true
    scope = 'M0 inventory checks; no license approval or geographic/field QA'
}
$validationResult | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $OutputPath -Encoding utf8
$validationResult | ConvertTo-Json -Depth 4
