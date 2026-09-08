// Config do PM2 usada NO SERVIDOR pelo deploy.sh.
//
// ATENCAO ao cwd: ele aponta para o symlink "current", NAO para o caminho
// real do release. O PM2 guarda o caminho que voce der aqui e reusa em todo
// restart; se der o caminho real do release, ele fica preso naquele release
// para sempre e os deploys seguintes nao aparecem no site.
// Apontando para o symlink, cada restart resolve o link de novo e pega o
// release novo.

const CURRENT = '/home/deploy/maximianos/current';
const SHARED_LOGS = '/home/deploy/maximianos/shared/logs';

module.exports = {
  apps: [
    {
      name: 'maximianos',
      script: 'server.js',
      cwd: CURRENT,

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '300M',
      watch: false,

      listen_timeout: 8000,
      kill_timeout: 5000,

      env: {
        NODE_ENV: 'production',
        PORT: 9000,
        HOST: '127.0.0.1'   // so o nginx acessa; nao exponha a 9000 na internet
      },

      out_file: SHARED_LOGS + '/out.log',
      error_file: SHARED_LOGS + '/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
