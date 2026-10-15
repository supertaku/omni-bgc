import io
import unittest
import zipfile
import xml.etree.ElementTree as ET
from office_helpers import importer, row
from workbook_audit import compare, directory_table, NS, REL_NS


def workbook(table, formula=False, target='worksheets/sheet1.xml'):
    namespace = NS['s']
    root = ET.Element(f'{{{namespace}}}worksheet')
    data = ET.SubElement(root, f'{{{namespace}}}sheetData')
    for number, values in enumerate(table, 1):
        element = ET.SubElement(data, f'{{{namespace}}}row', r=str(number))
        for column, value in enumerate(values):
            cell = ET.SubElement(element, f'{{{namespace}}}c', r=f'{chr(65 + column)}{number}', t='str')
            ET.SubElement(cell, f'{{{namespace}}}v').text = value
            if formula and number == 2 and column == 0:
                ET.SubElement(cell, f'{{{namespace}}}f').text = '1+1'
    book = ET.Element(f'{{{namespace}}}workbook')
    sheets = ET.SubElement(book, f'{{{namespace}}}sheets')
    ET.SubElement(sheets, f'{{{namespace}}}sheet', {'name': 'Full Directory', f'{{{REL_NS}}}id': 'directory'})
    links = ET.Element('Relationships')
    ET.SubElement(links, 'Relationship', Id='directory', Target=target)
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        archive.writestr('xl/workbook.xml', ET.tostring(book))
        archive.writestr('xl/_rels/workbook.xml.rels', ET.tostring(links))
        archive.writestr('xl/worksheets/sheet1.xml', ET.tostring(root))
    output.seek(0)
    return output


class WorkbookTests(unittest.TestCase):
    def test_dual_inputs_equal_and_mismatch_reviewed_without_repair(self):
        value = row()
        table = [list(importer.HEADERS), list(value.values())]
        report = compare(workbook(table), importer.HEADERS, [value])
        self.assertEqual(report['comparison'], 'equal')
        table[1][4] = '13F'
        report = compare(workbook(table), importer.HEADERS, [value])
        self.assertEqual(report['comparison'], 'review_required')
        self.assertEqual(report['differences'][0]['different_columns'], ['Floor / suite'])

    def test_extra_workbook_rows_are_visible(self):
        value = row()
        table = [list(importer.HEADERS), list(value.values()), list(value.values())]
        report = compare(workbook(table), importer.HEADERS, [value])
        self.assertEqual(report['differences'][0]['reason'], 'row_count_mismatch')

    def test_formulas_and_external_paths_rejected(self):
        table = [list(importer.HEADERS), list(row().values())]
        with self.assertRaises(ValueError):
            directory_table(workbook(table, formula=True))
        with self.assertRaises(ValueError):
            directory_table(workbook(table, target='../../outside.xml'))


if __name__ == '__main__':
    unittest.main()
