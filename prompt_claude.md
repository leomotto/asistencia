CONTEXTO DEL PROYECTO: Inyector SIDEAC -> MiEscuela (GCABA)

Actúa como un Desarrollador Full-Stack Senior experto en integraciones de APIs REST complejas.
Estamos construyendo un "Inyector de Calificaciones" para que mi aplicación de gestión escolar (SIDEAC) sincronice las notas locales de mis estudiantes hacia los servidores del GCABA (app "MiEscuela").

El usuario (docente) proporcionará un Token JWT válido (x-chino-token), el ID de la Sección (curso) y el Periodo a sincronizar (ej. 3 para 2do Bimestre).

ARQUITECTURA DEL INYECTOR: FLUJO DE 3 PASOS

La integración NUNCA debe hacer push a ciegas. Debe seguir estrictamente este flujo:

GET (Lectura del Estado): Obtener la planilla actual del GCABA para recolectar IDs dinámicos y evaluar el estado.

MATCH (Validador y Comparación): Cruzar los datos locales de SIDEAC con el estado del GCABA para buscar discrepancias y decidir si toca crear (POST) o actualizar (PUT).

POST/PUT (Escritura): Enviar los paquetes de notas al servidor.

PASO 1: LECTURA DEL ESTADO (GET)

Endpoint: GET https://api.prod.miescuela2.phinxlab.com/api/calificaciones/secundariocustom
Query Params obligatorios:

espacioCurricularSeccion[equals]={ID_SECCION} (Provisto por el usuario).

calificacion.periodo[equals]={ID_PERIODO} (Provisto por el usuario, ej: 3).

Resto de params requeridos por la API: group_start[group_start], and[and], offset=0, limit=100.

Headers obligatorios para TODAS las peticiones (GET, POST, PUT):

accept: */*

content-type: application/json; charset=utf-8

x-chino-token: {TOKEN_JWT_DEL_DOCENTE}

x-chino-aspect: default

x-libby-app: MiEscuelaApp

Datos Críticos a extraer del GET:

idAlumno (Identificador del estudiante).

idCalificacion (ID único de la columna para ese estudiante en este periodo).

nota.idConocimiento (Si existe, significa que el estudiante YA TIENE una nota cargada. Este ID es la celda específica).

PASO 2: LÓGICA DE DECISIÓN Y DISCREPANCIAS (CRÍTICO)

SIDEAC iterará sobre sus calificaciones locales y las cruzará con el estado devuelto por el GET usando id_miescuela == idAlumno.

Manejo de Discrepancias (Sync Validator):

SIDEAC "Huérfano" (En SIDEAC pero NO en MiEscuela): El estudiante existe en tu base local pero no en la API.
-> Acción en UI: Mostrar icono de advertencia. Deshabilitar el envío para este alumno (no intentar POST).

MiEscuela "Huérfano" (En MiEscuela pero NO en SIDEAC): El estudiante figura en la API pero no en tu base local.
-> Acción en UI: Mostrar una alerta al final de la tabla ofreciendo "Vincular manualmente" o importar al estudiante.

Reglas de Decisión para los que SÍ coinciden:

Si el estudiante en el GET NO TIENE nota.idConocimiento:
-> Preparar un paquete POST.

Si el estudiante en el GET SÍ TIENE nota.idConocimiento:
-> Preparar un paquete PUT.
(Optimización: Solo incluir en el PUT si el valor de la nota en SIDEAC es distinto al de GCABA).

Regla de Aprobación (Boolean):
La API requiere el campo aprobado. La lógica estricta es: aprobado = (nota >= 6). (Ej: 10,9,8,7,6 es true. 5,4,3,2,1,"-" es false).

PASO 3: ESCRITURA (POST / PUT)

Endpoint para POST y PUT: https://api.prod.miescuela2.phinxlab.com/api/calificaciones/secundario/

La API acepta envíos masivos. El payload es un Array de Objetos.
Se deben hacer peticiones separadas: un fetch POST (array de notas nuevas) y un fetch PUT (array de actualizaciones).

Estructura del Payload POST (Sin idConocimiento):

[
  {
    "alumno": {ID_ALUMNO},
    "espacioCurricularSeccion": { "idEspacioCurricularSeccion": {ID_SECCION} },
    "calificacion": { "idCalificacion": {ID_CALIFICACION_OBTENIDO_EN_GET} },
    "data": { "ppi": false, "calificacion": "{NOTA_STRING}" },
    "nota": "{NOTA_STRING}",
    "aprobado": {BOOLEAN_SEGUN_REGLA},
    "asistenciaEc": false,
    "createdAt": "{FECHA_ISO_ACTUAL}"
  }
]


Estructura del Payload PUT (Requiere idConocimiento):

[
  {
    "idConocimiento": {ID_CONOCIMIENTO_OBTENIDO_EN_GET},
    "alumno": {ID_ALUMNO},
    "espacioCurricularSeccion": { "idEspacioCurricularSeccion": {ID_SECCION} },
    "calificacion": { "idCalificacion": {ID_CALIFICACION_OBTENIDO_EN_GET} },
    "data": { "ppi": false, "calificacion": "{NOTA_STRING}" },
    "nota": "{NOTA_STRING}",
    "aprobado": {BOOLEAN_SEGUN_REGLA},
    "asistenciaEc": false,
    "createdAt": "{FECHA_ISO_ACTUAL}"
  }
]


REQUISITOS DE LA INTERFAZ (UI) EN SIDEAC

Staging Visual (Tabla Comparativa): Antes de enviar, mostrar: Nombre, Nota SIDEAC, Nota GCABA (obtenida del GET), y Estado (POST, PUT, o Error de Discrepancia).

Manejo Defensivo de Errores:

401/403: Alertar "Token expirado o Periodo cerrado en MiEscuela".

422: "Error de validación del GCABA (Planilla posiblemente cerrada)".

Usar try/catch y evitar que la caída de un request bloquee toda la aplicación.

Generar la lógica preferentemente en funciones limpias, separando la capa de red (fetching) de la capa visual (componentes).
