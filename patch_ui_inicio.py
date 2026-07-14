import re

with open("js/ui.js", "r") as f:
    js = f.read()

# Add inicioTab to the list of tabs
js = js.replace("['tomaDiaria', 'planillaGrilla', 'evaluaciones', 'panelBI', 'gestionAlumnos', 'gestionMaterias', 'gestionDocentes', 'auditoriaTab']",
                "['inicioTab', 'tomaDiaria', 'planillaGrilla', 'evaluaciones', 'panelBI', 'gestionAlumnos', 'gestionMaterias', 'gestionDocentes', 'auditoriaTab']")

# Add btnInicio to the list of sidebar buttons
js = js.replace("['btnToma', 'btnGrilla', 'btnEval', 'btnPanel', 'btnGestion', 'btnMaterias', 'btnDocentes', 'btnAuditoria']",
                "['btnInicio', 'btnToma', 'btnGrilla', 'btnEval', 'btnPanel', 'btnGestion', 'btnMaterias', 'btnDocentes', 'btnAuditoria']")

# Add btnMobileInicio to the list of mobile buttons
js = js.replace("['btnMobileToma', 'btnMobileGrilla', 'btnMobileEval', 'btnMobileGestion']",
                "['btnMobileInicio', 'btnMobileToma', 'btnMobileGrilla', 'btnMobileEval', 'btnMobileGestion']")

# Add to btnMap
js = js.replace("tomaDiaria:      'btnToma',",
                "inicioTab:       'btnInicio',\n      tomaDiaria:      'btnToma',")

# Add to mobileBtnMap
js = js.replace("tomaDiaria:     'btnMobileToma',",
                "inicioTab:      'btnMobileInicio',\n      tomaDiaria:     'btnMobileToma',")

with open("js/ui.js", "w") as f:
    f.write(js)
