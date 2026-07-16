// ... existing code ...
import React, { useState, useMemo } from 'react';
import { Search, Copy, Check, AlertCircle, FileJson, PlusCircle, Trash2 } from 'lucide-react';

export default function App() {
  const [inputJson, setInputJson] = useState('');
  const [processedData, setProcessedData] = useState([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // Función para normalizar texto (quitar tildes y pasar a minúsculas para la búsqueda)
// ... existing code ...
  const handleProcess = () => {
    setError('');
    setSuccessMsg('');

    if (!inputJson.trim()) {
      setError('Por favor, pegá un JSON en el cuadro de texto.');
      return;
    }

    try {
      const parsed = JSON.parse(inputJson);
      
      if (!Array.isArray(parsed)) {
        throw new Error('El JSON ingresado no es un arreglo (array) de datos.');
      }

      const extracted = parsed.map(item => {
        // Manejo seguro por si falta algún nodo en un registro específico
        const id_miescuela = item?.alumno?.idAlumno || 'N/A';
        const dni = item?.alumno?.persona?.documento || 'N/A';
        const apellidos = item?.alumno?.persona?.apellido || 'N/A';
        const nombres = item?.alumno?.persona?.nombre || 'N/A';
        
        // Nuevos campos estratégicos extraídos
        const email = item?.alumno?.persona?.email || '';
        const fecha_nacimiento = item?.alumno?.persona?.fechaNacimiento || 'N/A';
        const ciclo_lectivo = item?.cicloLectivo || 'N/A';
        const estado_alumno = item?.estadoAlumno || 'N/A'; // 2 suele ser activo regular
        
        // Extracción detallada de la sección
        const seccion_completa = item?.seccion?.nombreSeccion || 'N/A';
        const anio = item?.seccion?.anio?.descripcionAnio || 'N/A';
        const division = item?.seccion?.division || 'N/A';
        const id_seccion = item?.seccion?.idSeccion || 'N/A';

        return {
          id_miescuela,
          dni,
          apellidos,
          nombres,
          email,
          fecha_nacimiento,
          ciclo_lectivo,
          estado_alumno,
          anio,
          division,
          seccion_completa,
          id_seccion
        };
      });

      // Añadir sin duplicados basados en id_miescuela
      setProcessedData(prevData => {
        const existingIds = new Set(prevData.map(st => st.id_miescuela));
        const newStudents = extracted.filter(st => !existingIds.has(st.id_miescuela));
        const duplicatesCount = extracted.length - newStudents.length;
        
        if (newStudents.length > 0) {
          setSuccessMsg(`Se añadieron ${newStudents.length} alumnos nuevos.${duplicatesCount > 0 ? ` Se omitieron ${duplicatesCount} duplicados.` : ''}`);
        } else if (duplicatesCount > 0) {
          setError(`No se añadieron alumnos. Todos los ${duplicatesCount} estudiantes ya estaban en la lista.`);
        }

        return [...prevData, ...newStudents];
      });

      // Limpiar el input para el próximo pegado
      setInputJson('');
      
      // Ocultar mensaje de éxito después de 4 segundos
      setTimeout(() => setSuccessMsg(''), 4000);

    } catch (err) {
      setError('Error al procesar el JSON. Asegurate de haber copiado todo el texto correctamente. Detalle: ' + err.message);
    }
  };

  const clearData = () => {
    if (window.confirm("¿Estás seguro de que querés borrar toda la lista acumulada?")) {
      setProcessedData([]);
      setSearchTerm('');
      setError('');
      setSuccessMsg('');
    }
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return processedData;
    const term = normalizeText(searchTerm);
    return processedData.filter(student => {
      const searchString = `${student.apellidos} ${student.nombres} ${student.dni} ${student.anio} ${student.division}`;
      return normalizeText(searchString).includes(term);
    });
  }, [processedData, searchTerm]);

// ... existing code ...
          {/* Columna Izquierda: Input */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1 space-y-4">
            <label className="block text-sm font-semibold text-gray-700">
              Paso 1: Pegar JSON crudo (Por tandas)
            </label>
            <textarea
              className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-sm font-mono text-gray-600 bg-gray-50"
              placeholder='Pegá aquí el JSON de una división y repetí el proceso...'
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
            />
            
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-start space-x-2 text-sm">
                <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-start space-x-2 text-sm border border-green-100">
                <Check size={18} className="mt-0.5 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              onClick={handleProcess}
              className="w-full flex justify-center items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              <PlusCircle size={20} />
              <span>Añadir a la lista maestra</span>
            </button>
          </div>

          {/* Columna Derecha: Resultados */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col h-[600px]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-4 sm:space-y-0">
              <label className="text-sm font-semibold text-gray-700">
                Paso 2: Revisar Acumulado y Exportar
              </label>
              
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                {processedData.length > 0 && (
                  <>
                    <span className="text-sm text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">
                      Total: {processedData.length} alumnos
                    </span>
                    <button
                      onClick={clearData}
                      title="Borrar toda la lista"
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition duration-200"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button
                      onClick={handleCopy}
                      className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
                    >
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                      <span>{copied ? '¡Copiado!' : 'Exportar JSON Limpio'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                disabled={processedData.length === 0}
                placeholder="Buscar por apellido, DNI, año o división..."
                className="pl-10 w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex-1 overflow-auto border border-gray-200 rounded-lg">
              {processedData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                  <FileJson size={48} className="mb-4 opacity-50" />
                  <p>Aún no hay datos acumulados.<br/>Pegá el JSON de un curso a la izquierda y hacé clic en Añadir.</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Año/Div</th>
                      <th className="px-6 py-3 font-semibold">Apellidos</th>
                      <th className="px-6 py-3 font-semibold">Nombres</th>
                      <th className="px-6 py-3 font-semibold">DNI</th>
                      <th className="px-6 py-3 font-semibold">Email</th>
                      <th className="px-6 py-3 font-semibold">ID GCABA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((student, index) => (
                      <tr key={index} className="bg-white border-b hover:bg-blue-50/50 transition duration-150">
                        <td className="px-6 py-4">
                          <span className="font-semibold text-blue-700">{student.anio}</span>
                          <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold">{student.division}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{student.apellidos}</td>
                        <td className="px-6 py-4">{student.nombres}</td>
                        <td className="px-6 py-4 font-medium">{student.dni}</td>
                        <td className="px-6 py-4 text-xs text-blue-600">{student.email}</td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-500">{student.id_miescuela}</td>
                      </tr>
                    ))}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                          No se encontraron estudiantes que coincidan con la búsqueda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
// ... existing code ...