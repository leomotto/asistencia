// Año lectivo: marzo–diciembre del año corriente (enero/febrero pertenecen al año anterior)
const hoy  = new Date();
const Y    = hoy.getMonth() >= 2 ? hoy.getFullYear() : hoy.getFullYear() - 1;
const Y1   = Y + 1;

// Último día de cada mes según año
const ult = (mes) => new Date(Y, mes, 0).getDate();

const _cal = {
  "CLASES REGULARES":  { desde: `${Y}-03-02`,  hasta: `${Y}-12-03`  },
  "1er BIMESTRE":      { desde: `${Y}-03-02`,  hasta: `${Y}-05-07`  },
  "2do BIMESTRE":      { desde: `${Y}-05-08`,  hasta: `${Y}-07-17`  },
  "3er BIMESTRE":      { desde: `${Y}-08-03`,  hasta: `${Y}-10-02`  },
  "4to BIMESTRE":      { desde: `${Y}-10-05`,  hasta: `${Y}-12-03`  },
  "1er CUATRIMESTRE":  { desde: `${Y}-03-02`,  hasta: `${Y}-07-17`  },
  "2do CUATRIMESTRE":  { desde: `${Y}-08-03`,  hasta: `${Y}-12-03`  },
  "PO DIC":            { desde: `${Y}-12-04`,  hasta: `${Y}-12-18`  },
  "PO FEB-MAR":        { desde: `${Y1}-02-01`, hasta: `${Y1}-02-${new Date(Y1, 1, 0).getDate()}` },
};

// Meses marzo–diciembre del año lectivo
[['MARZO',3],['ABRIL',4],['MAYO',5],['JUNIO',6],['JULIO',7],
 ['AGOSTO',8],['SEPTIEMBRE',9],['OCTUBRE',10],['NOVIEMBRE',11],['DICIEMBRE',12]
].forEach(([n, m]) => {
  const num = String(m).padStart(2, '0');
  _cal[`${n} ${Y}`] = { desde: `${Y}-${num}-01`, hasta: `${Y}-${num}-${ult(m)}` };
});

// Enero y febrero del año siguiente (aún pertenecen al ciclo lectivo)
_cal[`ENERO ${Y}`]   = { desde: `${Y1}-01-01`, hasta: `${Y1}-01-31` };
_cal[`FEBRERO ${Y}`] = { desde: `${Y1}-02-01`, hasta: `${Y1}-02-${new Date(Y1, 1, 0).getDate()}` };

export const PERIODOS_CALENDARIO = _cal;
export const SCHOOL_YEAR = Y;
