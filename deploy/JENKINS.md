# Pipeline Jenkins - deploy automatico do Maximianos

Fluxo: alguem faz push na `main` do GitHub -> webhook chama o Jenkins ->
Jenkins valida, envia por rsync, ativa o release novo, testa, e faz rollback
sozinho se o site nao responder.

```
push na main
     |
     v
[Jenkins]  Checkout -> Validar -> Publicar (rsync) -> Smoke test
     |                                |
     |                                v
     |                    [servidor] deploy.sh
     |                       - npm ci
     |                       - troca o symlink current
     |                       - pm2 startOrReload
     |                       - health check (10 tentativas)
     |                       - rollback se falhar
     v
https://maximianos.com.br
```

Estrutura criada no servidor:

```
/home/deploy/maximianos/
|- releases/
|   |- 41-a1b2c3d/        <- release anterior
|   \- 42-e4f5g6h/        <- release novo
|- shared/logs/           <- logs que sobrevivem aos deploys
\- current -> releases/42-e4f5g6h
```

---

## Parte 1 - preparar o servidor (uma vez so)

### 1.1 Tirar a instalacao manual do caminho

Hoje os arquivos do site estao soltos em `/home/deploy/maximianos`. O pipeline
usa a mesma pasta, mas organizada em releases. Guarde o que esta la antes:

```bash
sudo -u deploy pm2 delete maximianos || true
sudo -u deploy pm2 save --force

sudo mkdir -p /home/deploy/backup-manual
sudo mv /home/deploy/maximianos/* /home/deploy/backup-manual/ 2>/dev/null || true
sudo mv /home/deploy/maximianos/.[!.]* /home/deploy/backup-manual/ 2>/dev/null || true
sudo chown -R deploy:deploy /home/deploy/backup-manual
```

O site fica fora do ar entre este passo e o primeiro deploy do Jenkins.
Se isso for um problema, faca esta parte so na hora do push.

Deu tudo certo depois? Pode apagar:

```bash
sudo rm -rf /home/deploy/backup-manual
```

### 1.2 Estrutura e dependencias

```bash
# usuario de deploy (se ainda nao existir)
sudo adduser --disabled-password --gecos "" deploy

# estrutura de diretorios
sudo mkdir -p /home/deploy/maximianos/releases /home/deploy/maximianos/shared/logs
sudo chown -R deploy:deploy /home/deploy/maximianos

# node, npm e pm2 disponiveis para o usuario deploy
sudo -u deploy bash -c 'node -v && npm -v && pm2 -v'
```

### 1.3 PM2

Se o `pm2` nao estiver instalado para o usuario deploy:

```bash
sudo npm install -g pm2
sudo -u deploy pm2 ping
```

E deixe o PM2 subir junto com o servidor:

```bash
sudo -u deploy pm2 startup systemd -u deploy --hp /home/deploy
# rode o comando com sudo que ele imprimir
```

## Parte 2 - chave SSH do Jenkins

Na maquina do Jenkins:

```bash
sudo -u jenkins ssh-keygen -t ed25519 -f /var/lib/jenkins/.ssh/maximianos -N "" -C "jenkins-maximianos"
sudo cat /var/lib/jenkins/.ssh/maximianos.pub
```

Copie a chave publica e coloque no servidor:

```bash
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy bash -c 'echo "COLE_A_CHAVE_PUBLICA_AQUI" >> /home/deploy/.ssh/authorized_keys'
sudo -u deploy chmod 700 /home/deploy/.ssh
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
```

Teste antes de continuar:

```bash
sudo -u jenkins ssh -i /var/lib/jenkins/.ssh/maximianos deploy@SEU_IP "whoami && pm2 -v"
```

## Parte 3 - Jenkins

Plugins necessarios:

- Pipeline
- Git / GitHub
- SSH Agent
- Workspace Cleanup

Cadastre a credencial:

**Manage Jenkins -> Credentials -> System -> Global -> Add Credentials**

- Kind: **SSH Username with private key**
- ID: `maximianos-deploy-key`  (tem que ser exatamente esse, o Jenkinsfile usa)
- Username: `deploy`
- Private key: cole o conteudo de `/var/lib/jenkins/.ssh/maximianos`

Crie o job:

**New Item -> Pipeline** (ou Multibranch Pipeline)

- Build Triggers: marque **GitHub hook trigger for GITScm polling**
- Pipeline: **Pipeline script from SCM**
  - SCM: Git
  - Repository URL: o repo do GitHub
  - Branch: `*/main`
  - Script Path: `Jenkinsfile`

## Parte 4 - webhook no GitHub

No repositorio: **Settings -> Webhooks -> Add webhook**

- Payload URL: `http://SEU-JENKINS:8080/github-webhook/`
- Content type: `application/json`
- Events: **Just the push event**

O Jenkins precisa estar acessivel pela internet para o GitHub alcancar.
Se ele estiver so na rede interna, troque o trigger por polling no Jenkinsfile:

```groovy
triggers {
    pollSCM('H/5 * * * *')   // verifica a cada 5 minutos
}
```

## Parte 5 - ajustar o Jenkinsfile

Uma linha so, no bloco `environment`:

```groovy
DEPLOY_HOST = 'SEU_IP_OU_HOSTNAME'
```

## Parte 6 - primeiro deploy

```bash
git add .
git commit -m "pipeline de deploy"
git push origin main
```

Acompanhe em **Console Output** no Jenkins.

---

## O que cada etapa faz

**Validar** - confere que `index.html`, `server.js` e `package.json` existem
e nao estao vazios, checa a sintaxe do servidor com `node --check`, e varre
o `index.html` procurando `href`/`src` que apontem para arquivos que nao
existem no repo. Isso pega o erro mais comum de time de front: mandar o HTML
novo e esquecer de commitar a imagem.

**Publicar** - `rsync` com `--link-dest` apontando para o release anterior.
Arquivo que nao mudou vira hardlink em vez de ser transferido de novo, entao
o video de 18 MB so viaja quando muda de verdade. Deploy fica em segundos.

**deploy.sh** (roda no servidor) - instala dependencias, troca o symlink
`current` de forma atomica, recarrega o PM2, e bate no `/health` ate 10 vezes.
Se nao responder, volta o symlink pro release anterior, recarrega e sai com
erro - o site fica no ar na versao velha e o build aparece vermelho.

**Smoke test** - confere o app na porta 9000 e o nginx na 80.

## Testado

O `deploy.sh` foi executado de verdade num ambiente equivalente:
release 1 subiu, release 2 substituiu corretamente, e um release
propositalmente quebrado disparou o rollback e devolveu o site para a
versao anterior, saindo com codigo 1.

## Detalhe que quebra deploy e ninguem descobre

O PM2 memoriza o `cwd` do primeiro `start`. Se ele guardar o caminho real
de um release (`/home/deploy/maximianos/releases/41-a1b2c3d`) em vez do symlink,
todo deploy seguinte roda "com sucesso" mas o site continua servindo o codigo
velho - o pior tipo de bug, porque tudo fica verde.

Por isso o `ecosystem.production.config.js` usa `cwd: '/home/deploy/maximianos/current'`
fixo, e o `deploy.sh` confere o `pm_cwd` antes de recarregar; se estiver
errado, recria o processo.

## Problemas comuns

| Sintoma | Causa | Solucao |
|---|---|---|
| `Host key verification failed` | primeira conexao SSH | ja tratado com `StrictHostKeyChecking=accept-new` |
| `Permission denied (publickey)` | chave nao autorizada | confira `/home/deploy/.ssh/authorized_keys` |
| `pm2: command not found` | PATH do SSH nao interativo | `sudo ln -s $(which pm2) /usr/local/bin/pm2` |
| Build verde, site velho | PM2 preso no cwd antigo | ja tratado no deploy.sh |
| Webhook nao dispara | Jenkins inacessivel | veja "Recent Deliveries" no webhook do GitHub |
| Deploy demora demais | rsync sem `--link-dest` | confira se o `current` existe |

## Rollback manual

```bash
ssh deploy@SEU_IP
ls -1t /home/deploy/maximianos/releases     # lista do mais novo pro mais velho
ln -sfn /home/deploy/maximianos/releases/<release-bom> /home/deploy/maximianos/current.tmp
mv -Tf /home/deploy/maximianos/current.tmp /home/deploy/maximianos/current
cd /home/deploy/maximianos/current && pm2 startOrReload deploy/ecosystem.production.config.js --update-env
```
