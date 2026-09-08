# Deploy: nginx + HTTPS para maximianos.com.br

Ubuntu/Debian. Assume que o site ja esta rodando no PM2 na porta 9000
e que o DNS de maximianos.com.br ja aponta pro IP do servidor.

---

## Passo 0 — conferir antes de comecar

```bash
# o app responde localmente?
curl -I http://127.0.0.1:9000

# o DNS aponta pra ca? compare com o IP do servidor
dig +short maximianos.com.br
dig +short www.maximianos.com.br
curl -s ifconfig.me; echo

# as portas 80 e 443 estao liberadas?
sudo ufw status
```

Se o `dig` nao devolver o IP do servidor, **pare aqui**. O certbot vai falhar
e o Let's Encrypt tem limite de 5 falhas por hora no mesmo dominio.

Libere as portas se precisar:

```bash
sudo ufw allow 'Nginx Full'     # abre 80 e 443
sudo ufw allow OpenSSH          # nao se tranque pra fora
```

Em VPS de nuvem (AWS, Oracle, GCP, Azure) confira tambem o Security Group
do painel — sao dois firewalls independentes.

---

## Passo 1 — instalar o arquivo de configuracao

Copie o `nginx-maximianos.conf` para o servidor e:

```bash
sudo cp nginx-maximianos.conf /etc/nginx/sites-available/maximianos
sudo ln -s /etc/nginx/sites-available/maximianos /etc/nginx/sites-enabled/
```

Tire o site padrao do caminho, senao ele pode responder no lugar do seu:

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

Teste e recarregue:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Se o `nginx -t` reclamar de `[::]:80 ... Address family not supported`,
o servidor nao tem IPv6 — a linha ja vem comentada por causa disso.

---

## Passo 2 — validar em HTTP antes do certbot

```bash
curl -I http://maximianos.com.br
```

Tem que voltar `200 OK`. Se voltar 502, o nginx subiu mas o Node nao esta
respondendo: `pm2 status` e `pm2 logs maximianos`.

**So passe pro certbot quando o HTTP estiver funcionando.** O certbot usa
o proprio nginx pra provar que o dominio e seu; se o HTTP nao responde,
a validacao falha.

---

## Passo 3 — HTTPS com o certbot

```bash
sudo certbot --nginx -d maximianos.com.br -d www.maximianos.com.br
```

Ele pergunta o e-mail, os termos, e se quer redirecionar HTTP -> HTTPS:
**escolha redirecionar (opcao 2)**.

O certbot edita o `/etc/nginx/sites-available/maximianos` sozinho: adiciona
o bloco `listen 443 ssl`, aponta os certificados e cria o redirect do 80.
Nao precisa mexer no arquivo depois.

Confira:

```bash
curl -I https://maximianos.com.br
curl -I http://maximianos.com.br     # deve responder 301 pro https
sudo certbot certificates
```

---

## Passo 4 — renovacao automatica

O pacote ja instala um timer do systemd. So confirme:

```bash
systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

Se o dry-run passar, esta resolvido: o certificado renova sozinho a cada
60 dias.

---

## Passo 5 — o app subir junto com o servidor

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd
# copie e rode o comando com sudo que ele imprimir
```

---

## Se der errado

| Sintoma | Causa provavel | Como ver |
|---|---|---|
| 502 Bad Gateway | Node caiu ou nao esta na 9000 | `pm2 status`, `curl -I http://127.0.0.1:9000` |
| 504 Gateway Timeout | App travado ou lento | `pm2 logs maximianos` |
| Certbot: "Timeout during connect" | Porta 80 fechada no firewall/painel | `sudo ufw status` + Security Group |
| Certbot: "DNS problem" | Registro A errado ou nao propagado | `dig +short maximianos.com.br` |
| Site do nginx padrao aparece | `default` ainda ativo | `ls /etc/nginx/sites-enabled/` |
| Video engasga | `proxy_buffering` ligado | ja tratado no bloco `.mp4` do conf |

Logs uteis:

```bash
sudo tail -f /var/log/nginx/maximianos.error.log
sudo tail -f /var/log/nginx/maximianos.access.log
pm2 logs maximianos
```

---

## Observacao sobre performance

Hoje todo request passa pelo Node, inclusive imagem e video. Funciona bem,
mas o nginx serve arquivo estatico mais rapido que o Node. Se um dia quiser
otimizar, basta adicionar isto no bloco `server` (ajustando o caminho real
da pasta no servidor):

```nginx
location ~* ^/(assets|css|js)/ {
    root /home/deploy/maximianos/current;
    expires 30d;
    access_log off;
    try_files $uri @app;
}

location @app {
    proxy_pass http://maximianos_app;
}
```

Assim o nginx entrega os estaticos direto do disco e so o HTML passa pelo Node.

Um detalhe se os estaticos ficarem em `/home/deploy`: o usuario do nginx
(`www-data`) precisa de permissao de travessia na home do deploy, senao da 403.

```bash
sudo chmod o+x /home/deploy
sudo chmod -R o+rX /home/deploy/maximianos
```

Isso nao e necessario enquanto tudo passar pelo Node (o cenario atual).
