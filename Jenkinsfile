// Pipeline de deploy do site Maximianos
// Gatilho: push na branch main (webhook do GitHub)
// Jenkins roda em outra maquina e publica via SSH + rsync.

pipeline {
    agent any

    options {
        // Dois deploys ao mesmo tempo corrompem o release. Nunca permita.
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timestamps()
        timeout(time: 15, unit: 'MINUTES')
    }

    triggers {
        githubPush()
    }

    environment {
        DEPLOY_HOST = '104.237.3.76'
        DEPLOY_USER = 'deploy'
        APP_DIR     = '/home/deploy/maximianos'
        APP_NAME    = 'maximianos'
        SSH_CRED    = 'maximianos-deploy-key'   // id da credencial no Jenkins
        SSH_OPTS    = '-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHA = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()
                    env.RELEASE = "${env.BUILD_NUMBER}-${env.GIT_SHA}"
                }
                echo "Release: ${env.RELEASE}"
            }
        }

        stage('Validar') {
            steps {
                sh '''
                    set -e

                    echo "--- arquivos obrigatorios ---"
                    test -s index.html    || { echo "ERRO: index.html vazio ou ausente"; exit 1; }
                    test -s server.js     || { echo "ERRO: server.js ausente"; exit 1; }
                    test -s package.json  || { echo "ERRO: package.json ausente"; exit 1; }

                    echo "--- sintaxe do servidor ---"
                    if command -v node >/dev/null 2>&1; then
                        node --check server.js
                        node -e "JSON.parse(require('fs').readFileSync('package.json'))"
                        echo "OK (node $(node -v))"
                    else
                        echo "AVISO: node nao instalado neste agente, pulando checagem de sintaxe"
                    fi

                    echo "--- o index referencia arquivos que existem? ---"
                    faltando=0
                    for f in $(grep -oE '(href|src)="[^"]+"' index.html \
                               | sed -E 's/.*="([^"]+)"/\\1/' \
                               | grep -vE '^(https?:|//|#|data:|mailto:|tel:)' \
                               | sed 's|^/||' | sort -u); do
                        if [ ! -e "$f" ]; then
                            echo "  FALTANDO: $f"
                            faltando=$((faltando+1))
                        fi
                    done
                    if [ "$faltando" -gt 0 ]; then
                        echo "ERRO: $faltando arquivo(s) referenciados no index nao existem no repo"
                        exit 1
                    fi
                    echo "OK: todos os assets referenciados existem"
                '''
            }
        }

        stage('Publicar') {
            when {
                anyOf {
                    branch 'main'
                    // job de pipeline simples (nao multibranch) nao define BRANCH_NAME
                    expression { return env.BRANCH_NAME == null }
                }
            }
            steps {
                sshagent(credentials: [env.SSH_CRED]) {
                    sh '''
                        set -e
                        DEST="$DEPLOY_USER@$DEPLOY_HOST"

                        echo "--- preparando diretorios no servidor ---"
                        ssh $SSH_OPTS "$DEST" "mkdir -p $APP_DIR/releases/$RELEASE $APP_DIR/shared/logs"

                        echo "--- enviando arquivos ---"
                        # --link-dest cria hardlink do que nao mudou desde o release
                        # anterior: o video de 18 MB so viaja quando muda de verdade.
                        rsync -az --delete \
                            --exclude '.git' \
                            --exclude '.github' \
                            --exclude 'node_modules' \
                            --exclude 'logs' \
                            --exclude '_v*' \
                            --link-dest="$APP_DIR/current" \
                            -e "ssh $SSH_OPTS" \
                            ./ "$DEST:$APP_DIR/releases/$RELEASE/"

                        echo "--- ativando release ---"
                        ssh $SSH_OPTS "$DEST" \
                            "bash $APP_DIR/releases/$RELEASE/deploy/deploy.sh $RELEASE"
                    '''
                }
            }
        }

        stage('Smoke test') {
            when {
                anyOf {
                    branch 'main'
                    expression { return env.BRANCH_NAME == null }
                }
            }
            steps {
                sshagent(credentials: [env.SSH_CRED]) {
                    sh '''
                        set -e
                        DEST="$DEPLOY_USER@$DEPLOY_HOST"

                        echo "--- app direto (porta 9000) ---"
                        ssh $SSH_OPTS "$DEST" "curl -fsS http://127.0.0.1:9000/health" && echo

                        echo "--- passando pelo nginx ---"
                        ssh $SSH_OPTS "$DEST" \
                            "curl -fsS -o /dev/null -w 'nginx: %{http_code}\\n' \
                             -H 'Host: maximianos.com.br' http://127.0.0.1/"
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "Deploy OK - release ${env.RELEASE} no ar em https://maximianos.com.br"
        }
        failure {
            echo "Deploy FALHOU no release ${env.RELEASE}."
            echo "O deploy.sh faz rollback sozinho se o health check falhar."
            echo "Investigue com: ssh ${env.DEPLOY_USER}@${env.DEPLOY_HOST} 'pm2 logs ${env.APP_NAME} --lines 50'"
        }
        always {
            cleanWs()
        }
    }
}
