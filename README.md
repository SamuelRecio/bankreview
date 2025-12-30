# BankReview

Aplicación Hono + Bun para analizar correos sospechosos de phishing usando un diccionario de palabras ponderadas. UI en español, con ejemplos listos y análisis en servidor.

## Requisitos
- Bun (recomendado)
- Node.js (puedes usarlo si prefieres `npm`/`pnpm`)
- Docker (opcional para contenedor)

## Ejecución local
```sh
bun install
bun run dev
# abre http://localhost:3000
```

Con Node.js (npm):
```sh
npm install
npm run start:node
# abre http://localhost:3000
```

Con Node.js (pnpm):
```sh
pnpm install
pnpm run start:node
# abre http://localhost:3000
```

## Flujo de uso (UI)
1) Carga dos archivos:
	 - CSV/TXT de palabras sospechosas con formato `palabra,valor`.
	 - TXT con el correo a analizar.
2) O usa la sección “Ejemplos interactivos”: elige un ejemplo, se previsualiza el CSV y el TXT desde `/examples/*`.
3) Pulsa “Analizar”: se envían los archivos por `multipart/form-data` a `/analisis`.
4) El servidor calcula frecuencia, puntaje y nivel de riesgo; la tabla y “Hallazgos” se actualizan.

## Formato de palabras
- Una línea por palabra: `palabra,valor` (valor numérico; si falta, usa 1).

## API backend
- `POST /analisis`
	- Body: `multipart/form-data` con `palabras` (CSV/TXT) y `correo` (TXT).
	- Respuesta: `{ resultados: [{ palabra, freq, valor, total }], puntajeTotal, riesgo }`.
- Archivos de ejemplo disponibles en `/examples/*`.

## Ejemplos incluidos
Carpeta `examples/` con escenarios: banco clásico, link falso, TI corporativo, cuenta bloqueada, transacción sospechosa, acceso desconocido, premio/sorteo, factura vencida, actualización de datos (cada uno con CSV y TXT).

## Docker
```sh
docker build -t bankreview .
docker run -p 3000:3000 bankreview
# abre http://localhost:3000
```

## Notas de seguridad
- Los archivos se procesan en memoria en el servidor; no se guardan en disco.
- Ajusta el diccionario de palabras según el banco/sector para mejorar la detección.
