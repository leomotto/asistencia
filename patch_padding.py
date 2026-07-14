import re

with open("index.html", "r") as f:
    html = f.read()

sections = ["inicioTab", "tomaDiaria", "panelBI", "gestionAlumnos", "gestionMaterias", "gestionDocentes", "auditoriaTab"]
for sec in sections:
    html = re.sub(f'<section id="{sec}" class="(.*?)\\bp-4 md:p-8\\b(.*?)"', f'<section id="{sec}" class="\\1p-4 pb-24 md:p-8\\2"', html)

sections2 = ["planillaGrilla", "evaluaciones"]
for sec in sections2:
    html = re.sub(f'<section id="{sec}" class="(.*?)\\bp-2 md:p-8\\b(.*?)"', f'<section id="{sec}" class="\\1p-2 pb-24 md:p-8\\2"', html)

with open("index.html", "w") as f:
    f.write(html)
print("Updated paddings for mobile navigation bar")
