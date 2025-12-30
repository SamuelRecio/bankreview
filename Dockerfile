# Usa la imagen oficial de Bun
FROM oven/bun:1 AS base
WORKDIR /app

# Instala dependencias
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copia el código fuente
COPY . .

# Expone el puerto 3000
EXPOSE 3000

# Comando para ejecutar la aplicación
CMD ["bun", "run", "src/index.ts"]
