import zipfile
import xml.etree.ElementTree as ET
import sys

def read_docx(path):
    try:
        with zipfile.ZipFile(path) as docx:
            xml_content = docx.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            paragraphs = []
            for p in tree.findall('.//w:p', namespaces):
                texts = p.findall('.//w:t', namespaces)
                if texts:
                    paragraphs.append(''.join([t.text for t in texts if t.text]))
            return '\n'.join(paragraphs)
    except Exception as e:
        return str(e)

if __name__ == '__main__':
    print(read_docx(sys.argv[1]))
