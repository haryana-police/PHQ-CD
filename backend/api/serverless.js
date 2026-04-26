const { app, buildApp } = require('../dist/index.js');

module.exports = async function (req, res) {
  await buildApp();
  await app.ready();
  app.server.emit('request', req, res);
};
