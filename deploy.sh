#!/bin/bash
# Script de despliegue a Alwaysdata mediante rsync sobre SSH

USER="muchacholoco"
HOST="ssh-muchacholoco.alwaysdata.net"
REMOTE_DIR="/home/muchacholoco/www/asistencia/"

# 1. Solicitar mensaje de commit si no fue provisto
COMMIT_MSG=$1
if [ -z "$COMMIT_MSG" ]; then
    read -p "📝 Ingresa el mensaje del commit: " COMMIT_MSG
fi

# Si el mensaje sigue vacío, abortamos
if [ -z "$COMMIT_MSG" ]; then
    echo "❌ Error: El mensaje de commit no puede estar vacío."
    exit 1
fi

echo "🚀 Iniciando proceso de commit y despliegue a $HOST..."

# 2. Actualizar versión (Bump)
node scripts/bump.js

# 3. Primer commit con los cambios y las versiones modificadas
git add .
git commit -m "$COMMIT_MSG"

# 4. Generar version.json con el hash exacto de este nuevo commit
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "dev")
GIT_DATE=$(git log -1 --format="%cd" --date=format:"%Y-%m-%d" 2>/dev/null || date +%Y-%m-%d)
SEM_VER=$(grep -oE 'app\.js\?v=[0-9.]+' index.html | head -1 | cut -d'=' -f2)
echo "{\"hash\":\"${GIT_HASH}\",\"date\":\"${GIT_DATE}\",\"version\":\"v${SEM_VER}\"}" > version.json
echo "📌 Versión: v${SEM_VER} (${GIT_HASH}) - ${GIT_DATE}"

# 5. Enmendar el commit para incluir el archivo version.json actualizado
git add version.json
git commit --amend --no-edit

# 6. Usar rsync para sincronizar el directorio actual con el remoto
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
