import re

with open("index.html", "r") as f:
    html = f.read()

# 1. Add inicioTab right before tomaDiaria
inicio_html = """
    <!-- PANTALLA: INICIO -->
    <section id="inicioTab" class="flex-1 w-full h-full overflow-y-auto p-4 md:p-8">
      <div class="max-w-4xl mx-auto space-y-6">
        
        <!-- Welcome Banner -->
        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
          <div class="relative z-10">
            <h2 class="text-3xl font-black mb-2" id="welcomeUserTitle">¡Hola!</h2>
            <p class="text-indigo-100 text-lg">Bienvenido al Sistema de Asistencia y Calificaciones (SIDEAC)</p>
          </div>
          <i class="ph ph-books text-9xl absolute -right-6 -bottom-6 text-white opacity-10 transform -rotate-12"></i>
        </div>

        <!-- Quick Actions Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onclick="switchTab('tomaDiaria')" class="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700 hover:shadow-md hover:border-emerald-500 transition-all text-left flex items-start gap-4 group">
            <div class="bg-emerald-100 dark:bg-emerald-900/30 p-3 rounded-2xl text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <i class="ph ph-calendar-check text-3xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Toma de Asistencia</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Registrar presentes y ausentes del día</p>
            </div>
          </button>

          <button onclick="switchTab('planillaGrilla')" class="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700 hover:shadow-md hover:border-blue-500 transition-all text-left flex items-start gap-4 group">
            <div class="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-2xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <i class="ph ph-table text-3xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Planilla de Asistencia</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Ver historial y porcentajes</p>
            </div>
          </button>

          <button onclick="switchTab('evaluaciones')" class="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700 hover:shadow-md hover:border-amber-500 transition-all text-left flex items-start gap-4 group">
            <div class="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <i class="ph ph-exam text-3xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Calificaciones</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Cargar notas y ver promedios</p>
            </div>
          </button>

          <button onclick="switchTab('gestionAlumnos')" class="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border dark:border-slate-700 hover:shadow-md hover:border-purple-500 transition-all text-left flex items-start gap-4 group">
            <div class="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-2xl text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <i class="ph ph-users text-3xl"></i>
            </div>
            <div>
              <h3 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Matrícula</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">Gestionar estudiantes e inscripciones</p>
            </div>
          </button>
        </div>
      </div>
    </section>
"""
html = html.replace('<!-- PANTALLA: TOMA DIARIA -->', inicio_html + '\n    <!-- PANTALLA: TOMA DIARIA -->')

# 2. Hide tomaDiaria by default
html = html.replace('<section id="tomaDiaria" class="flex-1 w-full h-full overflow-y-auto p-4 md:p-8">',
                    '<section id="tomaDiaria" class="flex-1 w-full h-full overflow-y-auto p-4 md:p-8 hidden">')

# 3. Add btnInicio to sidebar
btn_inicio = """        <button onclick="switchTab('inicioTab')" id="btnInicio" class="flex w-full items-center justify-start gap-3 bg-white/10 px-3 py-2.5 rounded-lg hover:bg-white/20 transition text-sm font-semibold" title="Inicio">
          <i class="ph ph-house text-xl flex-shrink-0"></i>
          <span class="truncate sidebar-text">Inicio</span>
        </button>"""
# replace btnToma's bg-white/10 with transparent
html = html.replace('id="btnToma" class="flex w-full items-center justify-start gap-3 bg-white/10',
                    'id="btnToma" class="flex w-full items-center justify-start gap-3')

# insert btnInicio before btnToma
html = html.replace('        <button onclick="switchTab(\'tomaDiaria\')" id="btnToma"',
                    btn_inicio + '\n' + '        <button onclick="switchTab(\'tomaDiaria\')" id="btnToma"')


# 4. Add btnMobileInicio to mobile bottom nav
btn_mobile_inicio = """      <button id="btnMobileInicio" onclick="switchTab('inicioTab')" class="flex flex-col items-center justify-center p-2 text-indigo-600 dark:text-indigo-400 transition-colors w-16">
        <i class="ph ph-house text-2xl mb-1"></i>
        <span class="text-[10px] font-bold">Inicio</span>
      </button>"""

# remove text-indigo-600 from btnMobileToma, add text-slate-500
html = html.replace('<button id="btnMobileToma" onclick="switchTab(\'tomaDiaria\')" class="flex flex-col items-center justify-center p-2 text-indigo-600 dark:text-indigo-400 transition-colors w-16">',
                    '<button id="btnMobileToma" onclick="switchTab(\'tomaDiaria\')" class="flex flex-col items-center justify-center p-2 text-slate-500 dark:text-slate-400 transition-colors w-16">')

html = html.replace('<button id="btnMobileToma"',
                    btn_mobile_inicio + '\n      <button id="btnMobileToma"')


with open("index.html", "w") as f:
    f.write(html)
