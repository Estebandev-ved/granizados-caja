// Sirve Index.html en modo demo para probarlo en el navegador: node tests/servir.js
const http = require('http'), fs = require('fs'), path = require('path');
const port = process.env.PORT || 5173;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(path.join(__dirname, '..', 'Index.html')));
}).listen(port, () => console.log('Demo en http://localhost:' + port));
