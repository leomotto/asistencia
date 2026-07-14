import re

with open("js/auth.js", "r") as f:
    js = f.read()

# Remove the #1 Restaurar último curso usado block
# The block spans from line 132 to 141
block_to_remove = """      // #1 Restaurar último curso usado en Toma Diaria
      const lastCurso = localStorage.getItem('lastCurso');
      if (lastCurso) {
        const selCurso = document.getElementById('tomaCurso');
        if (selCurso && [...selCurso.options].some(o => o.value === lastCurso)) {
          selCurso.value = lastCurso;
          window.app.actualizarHorariosYFechasRapidas?.();
          window.app.cargarAlumnos?.();
        }
      }"""

js = js.replace(block_to_remove, "")

with open("js/auth.js", "w") as f:
    f.write(js)
