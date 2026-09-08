/**
 * Servidor estatico - Maximianos
 * Serve os arquivos da propria pasta (index.html, css/, js/, assets/).
 * Rode com: pm2 start ecosystem.config.js
 */

const path = require('path');
const express = require('express');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 9000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

// Confia no proxy (nginx / cloudflare) para IP e protocolo corretos
app.set('trust proxy', true);
app.disable('x-powered-by');

// Gzip em html/css/js (nao mexe em imagem e video, que ja sao comprimidos)
app.use(compression());

// Log simples de requisicoes
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} ` +
      `${res.statusCode} ${Date.now() - inicio}ms`
    );
  });
  next();
});

// Health check - util para monitoramento, deploy e PM2
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), port: PORT });
});

/**
 * IMPORTANTE: o express.static serve TUDO que esta na pasta.
 * Sem este bloqueio, qualquer um baixaria /server.js, /package.json,
 * /deploy/DEPLOY-NGINX.md e o que mais estiver aqui dentro.
 * So o que interessa ao site fica publico.
 */
const BLOQUEADOS = [
  /^\/server\.js$/i,
  /^\/package(-lock)?\.json$/i,
  /^\/ecosystem[^/]*\.js$/i,
  /^\/Jenkinsfile$/i,
  /^\/(deploy|logs|node_modules|scripts|\.git)(\/|$)/i,
  /^\/_v[0-9]/i,          // versoes historicas do site, nao sao publicas
  /\.(md|log|env|sh|yml|yaml|ini|bak|old|sql)$/i,
  /^\/\./,               // qualquer coisa que comece com ponto
  /~$/                   // backups de editor
];

app.use((req, res, next) => {
  const caminho = decodeURIComponent(req.path);
  if (BLOQUEADOS.some((regra) => regra.test(caminho))) {
    return res.status(404).type('text/plain').send('Not found');
  }
  next();
});

// HTML sempre fresco: evita servir versao velha do index apos um deploy
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  }
  next();
});

// Arquivos estaticos. Assets ganham cache longo; o video ganha suporte a
// range requests automaticamente (o express.static ja faz isso).
app.use(
  express.static(ROOT, {
    index: 'index.html',
    extensions: ['html'],
    dotfiles: 'ignore',
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
    },
  })
);

// Qualquer outra rota cai no index (site de pagina unica)
app.use((req, res) => {
  res.status(200).sendFile(path.join(ROOT, 'index.html'));
});

// Erro inesperado nao derruba a resposta
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).send('Erro interno do servidor');
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Maximianos no ar em http://localhost:${PORT}`);
  console.log(`Servindo a pasta: ${ROOT}`);
});

// Encerramento limpo quando o PM2 manda parar/reiniciar
const encerrar = (sinal) => () => {
  console.log(`${sinal} recebido, encerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', encerrar('SIGINT'));
process.on('SIGTERM', encerrar('SIGTERM'));
