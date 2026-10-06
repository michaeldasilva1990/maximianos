# Maximianos — site + captura de leads e pesquisas (MongoDB)

O navegador **nunca** fala direto com o MongoDB (isso exporia a senha do banco).
O site conversa com um pequeno servidor Node/Express, que grava no MongoDB.

```
maximianos-final/
├── local.js               # execução local (npm start)
├── api/index.js           # entrada serverless do Vercel
├── vercel.json
├── package.json
├── .env.example           # copie para .env e preencha
├── src/
│   ├── createApp.js       # app Express (compartilhado local/Vercel)
│   ├── db.js              # conexão MongoDB
│   ├── util.js            # validações/normalização (e-mail, telefone, hash de IP)
│   ├── adminAuth.js       # proteção das rotas /api/admin
│   ├── csv.js             # exportação CSV
│   ├── models/Lead.js     # coleção "leads"
│   ├── models/Search.js   # coleção "searches"
│   └── routes/index.js    # endpoints
└── public/                # o site (index.html, css, js, assets)
    └── js/lead-gate.js    # formulário de entrada + envio das pesquisas
```

## Como rodar

1. Instale o Node 18+ e crie um banco (MongoDB Atlas gratuito ou local).
2. `cp .env.example .env` e preencha `MONGODB_URI`, `ADMIN_TOKEN` e `IP_SALT`.
3. `npm install`
4. `npm start` → abra http://localhost:3000

No Atlas, libere o IP do servidor em *Network Access*.

## O que é coletado

**leads** — e-mail e/ou telefone (único por campo), consentimento LGPD (com data), nº de visitas, UTMs, referrer, user-agent e hash do IP (o IP puro não é guardado).

**searches** — cada clique em "Buscar": serviço (voos/hotéis/pacotes/carros), origem, destino, datas, viajantes/quartos, só voos diretos, dados de carro, URL de redirecionamento e o lead que fez a busca.

## Ver os dados

```
GET /api/admin/leads?page=1&limit=100
GET /api/admin/searches?page=1&limit=100
GET /api/admin/searches?format=csv&limit=5000     (abre no Excel)
Header: Authorization: Bearer SEU_ADMIN_TOKEN
```
Exemplo: `curl -H "Authorization: Bearer TOKEN" "https://seusite/api/admin/searches?format=csv" -o pesquisas.csv`

Também dá para consultar direto no Atlas / MongoDB Compass (coleções `leads` e `searches`).

## Comportamento do formulário

- Abre sozinho na primeira visita; não fecha sem preencher (e-mail **ou** telefone + aceite).
- Depois de enviado, o `leadId` fica no `localStorage` e o formulário não aparece de novo naquele navegador.
- Para deixá-lo opcional, adicione um botão "Agora não" que chame `closeModal()` em `public/js/lead-gate.js`.

## Publicação

Qualquer host Node serve (Render, Railway, Fly.io, VPS). Configure as 3 variáveis de ambiente e use `npm start`.
Se o front-end ficar em outro domínio, defina `window.MAXIMIANOS_API_BASE` antes do `lead-gate.js` e adicione CORS no servidor.

## Observações

- Como o site coleta dados pessoais, mantenha uma Política de Privacidade publicada e linke-a no texto de consentimento.
- Rate limit já ativo nas rotas públicas (anti-spam).

## Deploy no Vercel

1. No MongoDB Atlas: *Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0)* (o Vercel não tem IP fixo).
2. Suba esta pasta para um repositório no GitHub e importe em vercel.com → *Add New → Project* (Framework: **Other**).
3. Em *Settings → Environment Variables* crie `MONGODB_URI`, `ADMIN_TOKEN` e `IP_SALT` (Production, Preview e Development).
4. Faça *Redeploy* (variáveis só valem para deploys novos).
5. Teste: abra o site, preencha o formulário e confira a coleção `leads` no Atlas.
