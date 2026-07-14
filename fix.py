import os

ui_path = "/home/leo/proyectos/asistencia/js/ui.js"
with open(ui_path, "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "document.getElementById(id)?.classList.remove(bg-white/10);" in line:
        line = "      document.getElementById(id)?.classList.remove('bg-white/10');\n"
    if "[btnToma, btnGrilla, btnEval" in line:
        line = "    ['btnToma', 'btnGrilla', 'btnEval', 'btnPanel', 'btnGestion', 'btnMaterias', 'btnDocentes', 'btnAuditoria'].forEach(id => {\n"
    if "[btnMobileToma, btnMobileGrilla" in line:
        line = "    ['btnMobileToma', 'btnMobileGrilla', 'btnMobileEval', 'btnMobileGestion'].forEach(id => {\n"
    if "el.classList.remove(text-indigo-600, dark:text-indigo-400);" in line:
        line = "        el.classList.remove('text-indigo-600', 'dark:text-indigo-400');\n"
    if "el.classList.add(text-slate-500, dark:text-slate-400);" in line:
        line = "        el.classList.add('text-slate-500', 'dark:text-slate-400');\n"
    if "if (btnMap[tabId]) document.getElementById(btnMap[tabId])?.classList.add(bg-white/10);" in line:
        line = "    if (btnMap[tabId]) document.getElementById(btnMap[tabId])?.classList.add('bg-white/10');\n"
    if "tomaDiaria:     btnMobileToma," in line:
        line = "      tomaDiaria:     'btnMobileToma',\n"
    if "planillaGrilla: btnMobileGrilla," in line:
        line = "      planillaGrilla: 'btnMobileGrilla',\n"
    if "evaluaciones:   btnMobileEval," in line:
        line = "      evaluaciones:   'btnMobileEval',\n"
    if "gestionAlumnos: btnMobileGestion" in line:
        line = "      gestionAlumnos: 'btnMobileGestion'\n"
    if "activeEl.classList.remove(text-slate-500, dark:text-slate-400);" in line:
        line = "        activeEl.classList.remove('text-slate-500', 'dark:text-slate-400');\n"
    if "activeEl.classList.add(text-indigo-600, dark:text-indigo-400);" in line:
        line = "        activeEl.classList.add('text-indigo-600', 'dark:text-indigo-400');\n"
    
    new_lines.append(line)

with open(ui_path, "w") as f:
    f.writelines(new_lines)
