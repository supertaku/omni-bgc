"""Read OOXML directory values without recalculating or modifying the workbook."""
import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'


def directory_table(path):
    with zipfile.ZipFile(path) as archive:
        if sum(i.file_size for i in archive.infolist()) > 25_000_000:
            raise ValueError('Workbook uncompressed-size limit exceeded')
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(si.itertext()) for si in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheets = workbook.find('s:sheets', NS)
        names = [s.attrib['name'] for s in sheets]
        selected = [s for s in sheets if s.attrib['name'] == 'Full Directory']
        if len(selected) != 1:
            raise ValueError('Expected exactly one Full Directory worksheet')
        relationships = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        relation = [r for r in relationships if r.attrib['Id'] == selected[0].attrib[f'{{{REL_NS}}}id']]
        if len(relation) != 1 or relation[0].attrib.get('TargetMode') == 'External':
            raise ValueError('Invalid directory worksheet relationship')
        target = relation[0].attrib['Target']
        target = posixpath.normpath(target.lstrip('/') if target.startswith('/') else 'xl/' + target)
        if not target.startswith('xl/worksheets/'):
            raise ValueError('Invalid worksheet path')
        rows = []
        for r in ET.fromstring(archive.read(target)).find('s:sheetData', NS):
            values = [''] * 19
            for cell in r:
                reference = re.fullmatch(r'([A-Z]+)\d+', cell.attrib['r'])
                if not reference:
                    raise ValueError('Invalid cell reference')
                index = 0
                for char in reference[1]:
                    index = index * 26 + ord(char) - ord('A') + 1
                if index > 19:
                    raise ValueError('Unexpected directory column')
                if cell.find('s:f', NS) is not None:
                    raise ValueError('Directory formulas require separate review')
                value = cell.find('s:v', NS)
                text = '' if value is None else (value.text or '')
                kind = cell.attrib.get('t')
                if kind == 's':
                    text = strings[int(text)]
                elif kind == 'inlineStr':
                    text = ''.join(t.text or '' for t in cell.findall('s:is//s:t', NS))
                values[index - 1] = text
            rows.append(values)
        return names, rows


def compare(path, header, raw_rows):
    names, table = directory_table(path)
    if not table or table[0] != list(header):
        raise ValueError('Workbook directory header differs from CSV')
    expected = [list(r.values()) for r in raw_rows]
    differences = []
    for index in range(max(len(expected), len(table) - 1)):
        left = expected[index] if index < len(expected) else None
        right = table[index + 1] if index + 1 < len(table) else None
        if left != right:
            differences.append({'source_row_ordinal': index + 1,
                                'different_columns': [header[i] for i in range(19) if left and right and left[i] != right[i]],
                                'reason': 'cell_values_differ' if left and right else 'row_count_mismatch'})
    return {'worksheet_names': names, 'directory_rows': len(table) - 1,
            'comparison': 'equal' if not differences else 'review_required', 'differences': differences}
