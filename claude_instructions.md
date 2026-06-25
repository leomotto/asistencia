# 🎨 Fase 1: Rediseño Total UI/UX (Sistema de Diseño Tailwind)

**Instrucciones exclusivas para Claude Code (Agente Programador):**
El Arquitecto de Software ha ordenado refactorizar todo el sistema de colores de la aplicación (`index.html` y los módulos JS si manipulan clases) para resolver inconsistencias en el modo oscuro y hovers rotos. 

Ejecuta estas tareas utilizando tus herramientas de edición masiva (replace/sed o edición directa en AST si es posible):

## 1. Limpieza de Configuración Tailwind
Abre `index.html` y modifica el `<script>` de `tailwind.config`.
- **Elimina** los colores personalizados obsoletos (`pizarra`, `nube`, `darkbg`, `darkcard`). El diseño ahora se basará estrictamente en la paleta oficial `slate` de Tailwind para fondos y neutrales, y `emerald` para acentos.

## 2. Refactor Masivo de Clases (Buscar y Reemplazar)
En todo el `index.html` y archivos `.js` de UI:
1. Reemplaza `bg-nube` por `bg-slate-50`.
2. Reemplaza `dark:bg-darkbg` por `dark:bg-slate-900`.
3. Reemplaza `bg-white dark:bg-darkcard` por `bg-white dark:bg-slate-800`.
4. Reemplaza `text-pizarra` por `text-slate-800 dark:text-slate-100`.
5. Reemplaza `border-gray-300 dark:border-gray-600` (y similares) por `border-slate-200 dark:border-slate-700`.
6. Reemplaza `text-gray-500 dark:text-gray-400` por `text-slate-500 dark:text-slate-400`.
7. Reemplaza el fondo de la etiqueta body: `bg-gray-100 dark:bg-darkbg` por `bg-slate-100 dark:bg-slate-900`.

## 3. Reparación de Hovers y Tablas
La grilla de asistencias y la toma diaria tenían problemas visuales al pasar el mouse.
- Busca las etiquetas `<tr>` o elementos clickeables y asegúrate de que usen: `hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`.
- Evita que los textos blancos desaparezcan sobre fondos blancos en las cabeceras de tablas. Asegura contraste usando `text-slate-900 dark:text-white`.

## 4. Testing Local
Una vez hechos los reemplazos, abre el `index.html` en tu navegador de testing, verifica que el switch de Modo Oscuro funcione y no queden artefactos visuales feos o textos ilegibles. 

Si el resultado es satisfactorio, indícale al usuario que la Fase Visual está completada.
