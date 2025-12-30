import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'

// App Hono sencillo que sirve un HTML con interfaz para analizar phishing.
// El análisis ahora se ejecuta en el servidor vía /analisis para simplificar la carga.
const app = new Hono()

type Resultado = { palabra: string; freq: number; valor: number; total: number }

function parsearPalabrasServidor(texto: string) {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const mapa = new Map<string, number>()
  for (const linea of lineas) {
    const [palabraRaw, valorRaw] = linea.split(',').map((p) => p?.trim())
    if (!palabraRaw) continue
    const palabra = palabraRaw.toLowerCase()
    const valor = Number(valorRaw) || 1
    mapa.set(palabra, valor)
  }
  return mapa
}

function normalizarTextoServidor(texto: string) {
  return texto
    .toLowerCase()
    .replace(/[^a-zA-Záéíóúñü0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function analizarServidor(palabrasMap: Map<string, number>, texto: string) {
  const tokens = normalizarTextoServidor(texto)
  const frecuencias = new Map<string, number>()
  for (const token of tokens) {
    if (palabrasMap.has(token)) {
      frecuencias.set(token, (frecuencias.get(token) || 0) + 1)
    }
  }
  const resultados: Resultado[] = Array.from(frecuencias.entries())
    .map(([palabra, freq]) => {
      const valor = palabrasMap.get(palabra) || 0
      return { palabra, freq, valor, total: freq * valor }
    })
    .sort((a, b) => b.total - a.total || b.freq - a.freq)

  const puntajeTotal = resultados.reduce((acc, r) => acc + r.total, 0)
  const riesgo = puntajeTotal >= 50 ? 'ALTO' : puntajeTotal >= 20 ? 'MEDIO' : 'BAJO'
  return { resultados, puntajeTotal, riesgo }
}

// Servimos archivos de ejemplo estáticos para las cargas interactivas.
app.use('/examples/*', serveStatic({ root: './' }))

// Endpoint que recibe multipart/form-data con archivos "palabras" (CSV) y "correo" (TXT)
// y devuelve JSON con resultados del análisis.
app.post('/analisis', async (c) => {
  try {
    const body = await c.req.parseBody()
    const palabrasFile = body.palabras
    const correoFile = body.correo

    if (!(palabrasFile instanceof File) || !(correoFile instanceof File)) {
      return c.json({ error: 'Faltan archivos palabras o correo' }, 400)
    }

    const textoPalabras = await palabrasFile.text()
    const textoCorreo = await correoFile.text()

    const mapa = parsearPalabrasServidor(textoPalabras)
    const { resultados, puntajeTotal, riesgo } = analizarServidor(mapa, textoCorreo)

    return c.json({ resultados, puntajeTotal, riesgo })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Error interno analizando' }, 500)
  }
})

app.get('/', (c) => {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Analizador de Phishing</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif; }
    .glass { backdrop-filter: blur(12px); background: rgba(15,23,42,0.7); }
    .gradient { background: radial-gradient(circle at 20% 20%, rgba(94,234,212,0.2), transparent 35%),
                           radial-gradient(circle at 80% 0%, rgba(59,130,246,0.2), transparent 30%),
                           linear-gradient(135deg, #0b1224 0%, #0f172a 100%); }
  </style>
</head>
<body class="min-h-screen gradient text-slate-50">
  <div class="max-w-5xl mx-auto px-4 py-10 space-y-8">
    <div class="flex items-center justify-center mb-8">
      <div class="text-center">
        <h1 class="text-6xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 bg-clip-text text-transparent mb-2">
          BankReview
        </h1>
        <div class="h-1 w-48 mx-auto bg-gradient-to-r from-emerald-400 via-teal-300 to-blue-400 rounded-full"></div>
      </div>
    </div>
    <header class="flex flex-col gap-3">
      <p class="text-sm uppercase tracking-[0.3em] text-emerald-300">Tema II · Phishing</p>
      <h1 class="text-4xl sm:text-5xl font-semibold leading-tight">Analizador simple de correos sospechosos</h1>
      <p class="text-slate-300 max-w-3xl">Carga un archivo de palabras sospechosas con su puntaje y un archivo de texto con el contenido del correo. Calculamos frecuencia y puntuación por palabra para ayudarte a detectar intentos de phishing, especialmente suplantación de bancos.</p>
    </header>

    <section class="glass rounded-2xl border border-slate-700/60 p-6 shadow-xl shadow-emerald-500/10">
      <div class="grid md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">1) Carga listas y correo</h2>
          <label class="block text-sm text-slate-300">Archivo de palabras (CSV: palabra,valor)</label>
          <input id="file-palabras" type="file" accept=".txt,.csv" class="w-full text-slate-200 bg-slate-900/60 border border-slate-700 rounded-lg p-3" />
          <p id="nombre-palabras" class="text-xs text-slate-400">Sin archivo seleccionado</p>
          <p class="text-xs text-slate-400">Formato esperado: una palabra por línea, separada por coma con su puntaje. Ej: "banco,10".</p>

          <label class="block text-sm text-slate-300">Archivo de correo (TXT)</label>
          <input id="file-correo" type="file" accept=".txt" class="w-full text-slate-200 bg-slate-900/60 border border-slate-700 rounded-lg p-3" />
          <p id="nombre-correo" class="text-xs text-slate-400">Sin archivo seleccionado</p>
        </div>
        <div class="space-y-3">
          <h2 class="text-xl font-semibold">2) Recomendaciones rápidas</h2>
          <ul class="text-sm text-slate-200 list-disc list-inside space-y-1">
            <li>Verifica dominio real: bancos reales no usan correos gratis.</li>
            <li>No hagas clic en enlaces abreviados; visita el sitio escribiendo la URL.</li>
            <li>Desconfía de urgencias: "bloqueo inmediato", "verifica ahora".</li>
            <li>Revisa ortografía y tono: errores y amenazas son comunes en phishing.</li>
            <li>Nunca envíes contraseñas, tokens o CVV por correo.</li>
          </ul>
        </div>
      </div>
      <div class="mt-6 flex gap-3 flex-wrap">
        <button id="btn-analizar" type="button" class="px-5 py-3 rounded-xl bg-emerald-500 text-slate-900 font-semibold hover:bg-emerald-400 active:translate-y-[1px] transition">Analizar</button>
        <button id="btn-ejemplos" type="button" class="px-5 py-3 rounded-xl border border-slate-600 text-slate-100 hover:border-emerald-400 transition">Cargar ejemplos</button>
        <p id="estado" class="text-sm text-slate-300"></p>
      </div>
    </section>

    <section id="section-ejemplos" class="glass rounded-2xl border border-slate-700/60 p-6 space-y-4">
      <div class="flex flex-col gap-1">
        <h2 class="text-xl font-semibold">Ejemplos interactivos</h2>
        <p class="text-slate-300 text-sm">Selecciona un ejemplo para cargar automáticamente los archivos y ver el CSV de palabras sospechosas.</p>
      </div>
      <div id="lista-ejemplos" class="grid md:grid-cols-3 gap-3"></div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <p class="text-sm text-slate-300">Vista previa CSV (palabra,valor)</p>
          <div id="preview-palabras" class="min-h-[180px] whitespace-pre-wrap text-xs font-mono bg-slate-900/60 border border-slate-700 rounded-xl p-3"></div>
        </div>
        <div class="space-y-2">
          <p class="text-sm text-slate-300">Vista previa correo (TXT)</p>
          <div id="preview-correo" class="min-h-[180px] whitespace-pre-wrap text-xs font-mono bg-slate-900/60 border border-slate-700 rounded-xl p-3"></div>
        </div>
      </div>
    </section>

    <section class="grid md:grid-cols-[2fr_1fr] gap-6">
      <div class="glass rounded-2xl border border-slate-700/60 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Informe</h2>
          <span id="resumen-puntaje" class="text-sm text-emerald-300"></span>
        </div>
        <div class="overflow-auto border border-slate-700 rounded-xl bg-slate-900/60">
          <table class="min-w-full text-sm text-left">
            <thead class="bg-slate-800/70 text-slate-200">
              <tr>
                <th class="px-4 py-3">Palabra</th>
                <th class="px-4 py-3">Frecuencia</th>
                <th class="px-4 py-3">Puntaje</th>
                <th class="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody id="tabla-resultados" class="divide-y divide-slate-800 text-slate-100"></tbody>
          </table>
        </div>
      </div>
      <div class="glass rounded-2xl border border-slate-700/60 p-6 space-y-3">
        <h2 class="text-xl font-semibold">Hallazgos</h2>
        <div id="hallazgos" class="text-sm text-slate-100 space-y-2"></div>
      </div>
    </section>
  </div>

  <script>
    const estado = document.getElementById('estado');
    const tabla = document.getElementById('tabla-resultados');
    const hallazgos = document.getElementById('hallazgos');
    const resumen = document.getElementById('resumen-puntaje');
    const btnEjemplos = document.getElementById('btn-ejemplos');
    const listaEjemplos = document.getElementById('lista-ejemplos');
    const previewPalabras = document.getElementById('preview-palabras');
    const previewCorreo = document.getElementById('preview-correo');
    const nombrePalabras = document.getElementById('nombre-palabras');
    const nombreCorreo = document.getElementById('nombre-correo');
    let ejemploTextoPalabras = '';
    let ejemploTextoCorreo = '';
    let ultimoEjemplo = { csv: '', correo: '' };

    const ejemplos = [
      {
        id: 'banco-clasico',
        titulo: 'Banco clásico',
        csv: 'banco-clasico.csv',
        correo: 'banco-clasico.txt',
        resumen: 'Aviso de bloqueo y verificación de credenciales.',
      },
      {
        id: 'banco-link-falso',
        titulo: 'Banco con link falso',
        csv: 'banco-link-falso.csv',
        correo: 'banco-link-falso.txt',
        resumen: 'Dominio engañoso y urgencia para actualizar acceso.',
      },
      {
        id: 'corporativo-it',
        titulo: 'Soporte corporativo',
        csv: 'corporativo-it.csv',
        correo: 'corporativo-it.txt',
        resumen: 'Suplantación de TI solicitando restablecer VPN/MFA.',
      },
      {
        id: 'cuenta-bloqueada',
        titulo: 'Cuenta bloqueada',
        csv: 'cuenta-bloqueada.csv',
        correo: 'cuenta-bloqueada.txt',
        resumen: 'Amenaza de suspensión permanente con enlace falso.',
      },
      {
        id: 'transaccion-sospechosa',
        titulo: 'Transacción sospechosa',
        csv: 'transaccion-sospechosa.csv',
        correo: 'transaccion-sospechosa.txt',
        resumen: 'Alerta falsa de transferencia no autorizada.',
      },
      {
        id: 'acceso-desconocido',
        titulo: 'Acceso desconocido',
        csv: 'acceso-desconocido.csv',
        correo: 'acceso-desconocido.txt',
        resumen: 'Notificación de inicio de sesión desde dispositivo nuevo.',
      },
      {
        id: 'premio-sorteo',
        titulo: 'Premio de sorteo',
        csv: 'premio-sorteo.csv',
        correo: 'premio-sorteo.txt',
        resumen: 'Phishing de lotería pidiendo datos bancarios para cobrar.',
      },
      {
        id: 'factura-pendiente',
        titulo: 'Factura vencida',
        csv: 'factura-pendiente.csv',
        correo: 'factura-pendiente.txt',
        resumen: 'Cobro falso con amenaza de suspensión de servicio.',
      },
      {
        id: 'actualizacion-datos',
        titulo: 'Actualización de datos',
        csv: 'actualizacion-datos.csv',
        correo: 'actualizacion-datos.txt',
        resumen: 'Solicitud fraudulenta de renovación de información personal.',
      },
    ];

    // Las funciones de análisis ahora viven en el servidor (/analisis).

    function renderResultados(resultados) {
      tabla.innerHTML = '';
      for (const r of resultados) {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/50';
        tr.innerHTML =
          '<td class="px-4 py-3 font-semibold">' + r.palabra + '</td>' +
          '<td class="px-4 py-3">' + r.freq + '</td>' +
          '<td class="px-4 py-3">' + r.valor + '</td>' +
          '<td class="px-4 py-3 text-emerald-300 font-semibold">' + r.total + '</td>';
        tabla.appendChild(tr);
      }
      if (!resultados.length) {
        tabla.innerHTML = '<tr><td class="px-4 py-3 text-slate-400" colspan="4">Sin coincidencias</td></tr>';
      }
    }

    function renderHallazgos({ puntajeTotal, resultados }) {
      hallazgos.innerHTML = '';
      const riesgo = puntajeTotal >= 50 ? 'ALTO' : puntajeTotal >= 20 ? 'MEDIO' : 'BAJO';
      const colores = { ALTO: 'text-red-300', MEDIO: 'text-amber-300', BAJO: 'text-emerald-300' };
      const titulo = document.createElement('p');
      titulo.className = 'font-semibold ' + colores[riesgo] + ' text-base';
      titulo.textContent = 'Riesgo ' + riesgo + ' (puntaje ' + puntajeTotal + ')';
      hallazgos.appendChild(titulo);

      if (resultados.length) {
        const lista = document.createElement('ul');
        lista.className = 'list-disc list-inside space-y-1';
        for (const r of resultados.slice(0, 5)) {
          const li = document.createElement('li');
          li.textContent = r.palabra + ': ' + r.freq + ' vez/veces, puntaje ' + r.valor;
          lista.appendChild(li);
        }
        hallazgos.appendChild(lista);
      } else {
        hallazgos.innerHTML += '<p class="text-slate-300">No se detectaron palabras señaladas.</p>';
      }
      resumen.textContent = puntajeTotal ? 'Puntaje total: ' + puntajeTotal : '';
    }

    function renderEjemplos() {
      listaEjemplos.innerHTML = '';
      ejemplos.forEach((ej) => {
        const card = document.createElement('button');
        card.className = 'text-left border border-slate-700 rounded-xl bg-slate-900/60 hover:border-emerald-400 transition p-4 flex flex-col gap-2';
        card.innerHTML =
          '<div class="flex items-start justify-between gap-3">' +
            '<div>' +
              '<p class="font-semibold text-slate-100">' + ej.titulo + '</p>' +
              '<p class="text-sm text-slate-300">' + ej.resumen + '</p>' +
            '</div>' +
            '<span class="text-emerald-300 text-xs uppercase tracking-wide">Cargar</span>' +
          '</div>' +
          '<p class="text-[11px] text-slate-400">' + ej.csv + ' · ' + ej.correo + '</p>';
        card.addEventListener('click', () => cargarEjemplo(ej));
        listaEjemplos.appendChild(card);
      });
    }

    function actualizarNombreArchivos() {
      const f1 = document.getElementById('file-palabras').files?.[0];
      const f2 = document.getElementById('file-correo').files?.[0];
      nombrePalabras.textContent = f1
        ? 'Seleccionado: ' + f1.name
        : ejemploTextoPalabras
        ? 'Usando ejemplo: ' + (ultimoEjemplo.csv || 'ejemplo.csv')
        : 'Sin archivo seleccionado';
      nombreCorreo.textContent = f2
        ? 'Seleccionado: ' + f2.name
        : ejemploTextoCorreo
        ? 'Usando ejemplo: ' + (ultimoEjemplo.correo || 'ejemplo.txt')
        : 'Sin archivo seleccionado';
    }

    async function analizarArchivos() {
      let filePalabras = document.getElementById('file-palabras').files[0];
      let fileCorreo = document.getElementById('file-correo').files[0];

      if (!filePalabras && ejemploTextoPalabras) {
        filePalabras = new File([ejemploTextoPalabras], 'ejemplo.csv', { type: 'text/csv' });
      }
      if (!fileCorreo && ejemploTextoCorreo) {
        fileCorreo = new File([ejemploTextoCorreo], 'ejemplo.txt', { type: 'text/plain' });
      }

      if (!filePalabras || !fileCorreo) {
        estado.textContent = 'Carga ambos archivos primero o elige un ejemplo.';
        actualizarNombreArchivos();
        return;
      }
      try {
        estado.textContent = 'Subiendo y analizando...';
        const fd = new FormData();
        fd.append('palabras', filePalabras);
        fd.append('correo', fileCorreo);
        const resp = await fetch('/analisis', { method: 'POST', body: fd });
        if (!resp.ok) {
          estado.textContent = 'El servidor no pudo analizar (HTTP ' + resp.status + ')';
          return;
        }
        const data = await resp.json();
        renderResultados(data.resultados || []);
        renderHallazgos({ resultados: data.resultados || [], puntajeTotal: data.puntajeTotal || 0 });
        estado.textContent = 'Listo (análisis en servidor). Riesgo: ' + data.riesgo;
      } catch (err) {
        console.error(err);
        estado.textContent = 'Ocurrió un error leyendo o analizando.';
      }
    }

    async function cargarEjemplo(ej) {
      try {
        estado.textContent = 'Cargando ejemplo...';
        const [textoPalabras, textoCorreo] = await Promise.all([
          fetch('/examples/' + ej.csv).then((r) => r.text()),
          fetch('/examples/' + ej.correo).then((r) => r.text()),
        ]);

        ejemploTextoPalabras = textoPalabras;
        ejemploTextoCorreo = textoCorreo;
        ultimoEjemplo = { csv: ej.csv, correo: ej.correo };
        previewPalabras.textContent = textoPalabras;
        previewCorreo.textContent = textoCorreo;

        if (typeof DataTransfer !== 'undefined') {
          const dt = new DataTransfer();
          dt.items.add(new File([textoPalabras], ej.csv, { type: 'text/csv' }));
          document.getElementById('file-palabras').files = dt.files;

          const dt2 = new DataTransfer();
          dt2.items.add(new File([textoCorreo], ej.correo, { type: 'text/plain' }));
          document.getElementById('file-correo').files = dt2.files;
        }

        actualizarNombreArchivos();

        estado.textContent = 'Ejemplo cargado. Presiona Analizar.';
      } catch (e) {
        console.error(e);
        estado.textContent = 'No se pudo cargar el ejemplo.';
      }
    }

    document.getElementById('file-palabras').addEventListener('change', actualizarNombreArchivos);
    document.getElementById('file-correo').addEventListener('change', actualizarNombreArchivos);
    document.getElementById('btn-analizar').addEventListener('click', analizarArchivos);
    btnEjemplos.addEventListener('click', () => {
      const sec = document.getElementById('section-ejemplos');
      if (sec) {
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        estado.textContent = 'Abajo tienes la lista de ejemplos. Elige uno para cargarlo.';
      }
    });
    renderEjemplos();
    actualizarNombreArchivos();
  </script>
</body>
</html>`

  return c.html(html)
})

export default app