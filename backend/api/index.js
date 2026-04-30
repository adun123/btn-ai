const app = require('../backend/src/app');

module.exports = (req, res) => {
  // 🔥 handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  req.url = req.url.replace(/^\/api/, '');
  return app(req, res);
};
