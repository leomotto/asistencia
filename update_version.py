import os
import glob
import json

OLD_VERSION = "9.83"
NEW_VERSION = "9.84"

files_to_update = glob.glob('js/*.js') + ['index.html']

for filepath in files_to_update:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if OLD_VERSION in content:
        content = content.replace(f"v={OLD_VERSION}", f"v={NEW_VERSION}")
        content = content.replace(f"{OLD_VERSION}", f"{NEW_VERSION}")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")

with open('version.json', 'r', encoding='utf-8') as f:
    v_data = json.load(f)

v_data['version'] = NEW_VERSION
with open('version.json', 'w', encoding='utf-8') as f:
    json.dump(v_data, f, indent=2)
print("Updated version.json")
