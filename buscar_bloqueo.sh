#!/bin/bash

SALIDA="reporte_permisos.txt"

echo "🔍 Buscando configuraciones globales de Antigravity/Claude..." > $SALIDA
echo "===========================================================" >> $SALIDA

echo -e "\n--> 1. Archivos que mencionan 'git push':" >> $SALIDA
grep -ri "git push" ~/.claude/ ~/.config/agy/ ~/.antigravity/ --include="*.json" --exclude="*history*" --exclude-dir="plugins" --exclude-dir="extensions" 2>/dev/null >> $SALIDA

echo -e "\n--> 2. Archivos que contienen reglas 'deny':" >> $SALIDA
grep -ri "deny" ~/.claude/ ~/.config/agy/ ~/.antigravity/ --include="*.json" --exclude="*history*" --exclude-dir="plugins" --exclude-dir="extensions" 2>/dev/null >> $SALIDA

echo -e "\n===========================================================" >> $SALIDA
echo "✅ Búsqueda terminada. Revisá el archivo '$SALIDA'."
