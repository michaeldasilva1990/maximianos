require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const { connectDB } = require('./db');

const app = express();
app.set('trust proxy', 1); // necessário atrás de proxy (Render, Railway, Nginx...)

// CSP desativada porque o site usa GTM, Meta Pixel, Zoho e Google Fonts.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(express.json({ limit: '20kb' }));

// Garante a conexão com o Mongo antes de cada rota da API (reaproveitada entre invocações).
app.use('/api', async (req, res, next) => { try { await connectDB(); next(); } catch (e) { next(e); } });
app.use('/api', require('./routes'));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Erro interno' : 'Requisição inválida' });
});

module.exports = app;
