module.exports = {
  apps: [
    {
      name: 'maximianos',
      script: 'server.js',
      cwd: __dirname,

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '300M',

      // watch: true reinicia sozinho ao editar arquivos.
      // Deixe false em producao.
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'assets'],

      env: {
        NODE_ENV: 'production',
        PORT: 9000,
        HOST: '0.0.0.0'
      },

      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
