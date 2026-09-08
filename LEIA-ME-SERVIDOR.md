# Servidor Maximianos (Express + PM2)

Serve o `index.html` e a pasta inteira (`css/`, `js/`, `assets/`) na porta **9000**.

## 1. Instalar

Abra o PowerShell **nesta pasta** e rode:

```powershell
npm install
npm install -g pm2
```

## 2. Subir com PM2

```powershell
pm2 start ecosystem.config.js
```

Pronto: http://localhost:9000

## 3. Comandos do dia a dia

```powershell
pm2 status                 # o que esta rodando
pm2 logs maximianos        # ver logs ao vivo
pm2 restart maximianos     # reiniciar apos mudar o HTML/CSS/JS
pm2 stop maximianos        # parar
pm2 delete maximianos      # remover da lista do PM2
pm2 monit                  # painel de CPU/memoria
```

Os logs tambem ficam em `logs/out.log` e `logs/error.log`.

## 4. Subir sozinho quando ligar o PC (Windows)

O `pm2 startup` normal nao funciona no Windows. Use:

```powershell
pm2 save
npm install -g pm2-windows-startup
pm2-startup install
```

## 5. Testar de outro aparelho na mesma rede

O servidor escuta em `0.0.0.0`, entao basta liberar a porta no firewall:

```powershell
# rode como Administrador
New-NetFirewallRule -DisplayName "Maximianos 9000" -Direction Inbound -LocalPort 9000 -Protocol TCP -Action Allow
```

Depois acesse `http://SEU-IP-LOCAL:9000` (descubra o IP com `ipconfig`).

## 6. Colocar atras do nginx depois

Quando for para o servidor de verdade, o nginx so precisa repassar:

```nginx
server {
    listen 80;
    server_name maximianos.com.br www.maximianos.com.br;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Depois `sudo certbot --nginx -d maximianos.com.br -d www.maximianos.com.br` para o HTTPS.

## Detalhes do que o servidor faz

- Gzip em HTML/CSS/JS (imagem e video ficam de fora, ja sao comprimidos).
- `Cache-Control: no-cache` no HTML, cache de 7 dias nos assets.
- Suporte a *range requests*, entao o video do hero (18 MB) faz streaming
  e permite arrastar a barra sem baixar tudo.
- `/health` devolve um JSON com status e uptime.
- Qualquer rota desconhecida cai no `index.html`.
- Encerramento limpo no SIGINT/SIGTERM, para o PM2 reiniciar sem derrubar
  requisicao no meio.

## Mudar a porta

Edite `PORT` no `ecosystem.config.js` e rode `pm2 restart maximianos --update-env`.
