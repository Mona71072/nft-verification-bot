const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8083;

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // URLからクエリパラメータを除去
  let filePath = req.url.split('?')[0];
  
  // デフォルトでverify.htmlを提供
  if (filePath === '/' || filePath === '/verify.html') {
    filePath = '/verify.html';
  }
  
  const fullPath = path.join(__dirname, filePath);
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      console.error('File not found:', fullPath);
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }
    
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (ext) {
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Web server running on http://localhost:${PORT}`);
  console.log(`📄 Serving: ${__dirname}`);
}); 