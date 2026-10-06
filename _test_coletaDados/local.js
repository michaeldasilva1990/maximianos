// Execução local (npm start). No Vercel é usado api/index.js.
const app = require('./src/createApp');
const { connectDB } = require('./src/db');

const PORT = process.env.PORT || 3000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`)))
  .catch((err) => { console.error('Falha ao conectar no MongoDB:', err.message); process.exit(1); });
