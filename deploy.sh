#!/bin/bash
# Script de despliegue a Alwaysdata mediante rsync sobre SSH

USER="muchacholoco"
HOST="ssh-muchacholoco.alwaysdata.net"
REMOTE_DIR="/home/muchacholoco/www/asistencia/"

echo "🚀 Iniciando despliegue a $HOST..."

# Generar version.json con hash de commit y fecha para mostrar en la UI
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
GIT_DATE=$(git log -1 --format="%cd" --date=format:"%Y-%m-%d" 2>/dev/null || date +%Y-%m-%d)
SEM_VER=$(grep -oE 'app\.js\?v=[0-9.]+' index.html | head -1 | cut -d'=' -f2)
echo "{\"hash\":\"${GIT_HASH}\",\"date\":\"${GIT_DATE}\",\"version\":\"v${SEM_VER}\"}" > version.json
echo "📌 Versión: v${SEM_VER} (${GIT_HASH}) - ${GIT_DATE}"

# Usar rsync para sincronizar el directorio actual con el remoto
# -a: archive mode (recursivo, mantiene permisos)
# -v: verbose
# -z: compresión
# --exclude: ignora archivos y directorios no deseados
rsync -avz --exclude '.git' \
           --exclude '.gemini' \
           --exclude 'scratch' \
           --exclude 'deploy.sh' \
           --exclude 'firestore.rules' \
           --exclude '*.md' \
           --exclude '.claude' \
           --exclude 'node_modules' \
           --exclude '.DS_Store' \
           ./ $USER@$HOST:$REMOTE_DIR

if [ $? -eq 0 ]; then
  echo "✅ Despliegue completado con éxito."
else
  echo "❌ Error en el despliegue."
fi
