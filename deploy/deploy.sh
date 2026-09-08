#!/usr/bin/env bash
#
# Ativa um release no servidor. Roda NO SERVIDOR, chamado pelo Jenkins.
# Uso: bash deploy.sh <nome-do-release>
#
# Estrutura esperada:
#   /home/deploy/maximianos/
#   |- releases/<release>/     <- codigo enviado pelo Jenkins
#   |- shared/logs/            <- logs que sobrevivem aos deploys
#   \- current -> releases/<release ativo>

set -euo pipefail

RELEASE="${1:?informe o nome do release}"
APP_DIR="${APP_DIR:-/home/deploy/maximianos}"
APP_NAME="${APP_NAME:-maximianos}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:9000/health}"
MANTER="${MANTER:-5}"          # quantos releases antigos guardar

RELEASE_DIR="$APP_DIR/releases/$RELEASE"
ANTERIOR=""

log()  { echo "[deploy] $*"; }
erro() { echo "[deploy] ERRO: $*" >&2; }

# ---------------------------------------------------------------
# Guarda qual release estava ativo, para poder voltar
# ---------------------------------------------------------------
if [ -L "$APP_DIR/current" ]; then
    ANTERIOR="$(readlink -f "$APP_DIR/current")"
    log "release atual: $(basename "$ANTERIOR")"
fi

[ -d "$RELEASE_DIR" ] || { erro "release $RELEASE nao existe em $RELEASE_DIR"; exit 1; }

# ---------------------------------------------------------------
# Dependencias
# ---------------------------------------------------------------
cd "$RELEASE_DIR"

log "instalando dependencias..."
if [ -f package-lock.json ]; then
    npm ci --omit=dev --no-audit --no-fund
else
    log "sem package-lock.json - usando npm install (commite o lock no repo!)"
    npm install --omit=dev --no-audit --no-fund
fi

# ---------------------------------------------------------------
# Logs compartilhados: o PM2 escreve fora do release, senao a
# limpeza de releases antigos apagaria o historico de log.
# ---------------------------------------------------------------
mkdir -p "$APP_DIR/shared/logs"
rm -rf "$RELEASE_DIR/logs"
ln -sfn "$APP_DIR/shared/logs" "$RELEASE_DIR/logs"

# ---------------------------------------------------------------
# Troca o symlink de forma atomica (ln -T + mv nao deixa janela
# em que o current aponta pra lugar nenhum)
# ---------------------------------------------------------------
log "ativando $RELEASE..."
ln -sfn "$RELEASE_DIR" "$APP_DIR/current.tmp"
mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"

# ---------------------------------------------------------------
# Sobe/recarrega no PM2
# ---------------------------------------------------------------
cd "$APP_DIR/current"

# O PM2 memoriza o cwd do primeiro start. Se por qualquer motivo ele estiver
# apontando para o caminho real de um release antigo (e nao para o symlink
# "current"), o reload sobe o codigo velho de novo e o deploy passa "verde"
# sem ter mudado nada. Entao conferimos e, se estiver errado, recriamos.
export APP_NAME
CWD_ESPERADO="$APP_DIR/current"
CWD_ATUAL="$(pm2 jlist 2>/dev/null | node -e "
  let d = '';
  process.stdin.on('data', c => d += c).on('end', () => {
    try {
      const app = JSON.parse(d).find(x => x.name === process.env.APP_NAME);
      console.log(app ? app.pm2_env.pm_cwd : '');
    } catch (e) { console.log(''); }
  });
" 2>/dev/null || true)"

if [ -n "$CWD_ATUAL" ] && [ "$CWD_ATUAL" != "$CWD_ESPERADO" ]; then
    log "PM2 estava preso em $CWD_ATUAL - recriando o processo"
    pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
fi

log "recarregando PM2..."
pm2 startOrReload deploy/ecosystem.production.config.js --update-env

# NOTA: nao usamos "pm2 save" aqui de proposito. O save grava a lista inteira
# de processos do usuario, e se qualquer OUTRA aplicacao estiver parada no
# momento do deploy, ela sumiria da lista de boot. Atualize a lista de boot
# manualmente quando quiser, com "pm2 save".

# ---------------------------------------------------------------
# Health check com retentativa (o app leva um instante pra subir)
# ---------------------------------------------------------------
log "verificando saude em $HEALTH_URL"
ok=0
for tentativa in $(seq 1 10); do
    if curl -fsS --max-time 3 "$HEALTH_URL" >/dev/null 2>&1; then
        ok=1
        log "app respondeu na tentativa $tentativa"
        break
    fi
    sleep 2
done

# ---------------------------------------------------------------
# Rollback automatico se nao respondeu
# ---------------------------------------------------------------
if [ "$ok" -ne 1 ]; then
    erro "app nao respondeu ao health check"
    if [ -n "$ANTERIOR" ] && [ -d "$ANTERIOR" ]; then
        erro "voltando para $(basename "$ANTERIOR")"
        ln -sfn "$ANTERIOR" "$APP_DIR/current.tmp"
        mv -Tf "$APP_DIR/current.tmp" "$APP_DIR/current"
        cd "$APP_DIR/current"
        pm2 startOrReload deploy/ecosystem.production.config.js --update-env || true
        erro "rollback concluido - o site continua na versao anterior"
    else
        erro "nao existe release anterior para voltar"
    fi
    pm2 logs "$APP_NAME" --lines 30 --nostream || true
    exit 1
fi

# ---------------------------------------------------------------
# Limpeza dos releases antigos
# ---------------------------------------------------------------
log "mantendo os $MANTER releases mais recentes"
cd "$APP_DIR/releases"
ATIVO="$(basename "$(readlink -f "$APP_DIR/current")")"
ls -1dt */ 2>/dev/null | sed 's|/$||' | tail -n +$((MANTER + 1)) | while read -r velho; do
    [ "$velho" = "$ATIVO" ] && continue
    log "removendo release antigo: $velho"
    rm -rf "${APP_DIR:?}/releases/${velho:?}"
done

log "deploy concluido: $RELEASE"
