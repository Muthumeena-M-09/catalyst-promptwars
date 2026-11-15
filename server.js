const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
try { process.loadEnvFile(path.join(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
if (publicKey.startsWith('sb_secret_')) throw new Error('Use a publishable key, never a Supabase secret key.');
if (publicKey.split('.').length === 3) {
  try { if (JSON.parse(Buffer.from(publicKey.split('.')[1], 'base64url')).role !== 'anon') throw new Error('Not an anon key'); }
  catch { throw new Error('Only a publishable key or legacy anon key is allowed.'); }
}
http.createServer((req,res)=>{
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (pathname === '/config.js') {
    res.setHeader('Content-Type','text/javascript'); res.setHeader('Cache-Control','no-store');
    return res.end('window.KINDRED_CONFIG = ' + JSON.stringify({url:process.env.SUPABASE_URL || '',key:publicKey.includes('PASTE_')?'':publicKey}) + ';');
  }
  if (!['/','/index.html','/styles.css','/cloud.css','/app.js','/cloud.js'].includes(pathname)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');} res.setHeader('Content-Type',({'html':'text/html','css':'text/css','js':'text/javascript'})[path.extname(file).slice(1)] || 'text/plain');res.end(data);});
}).listen(3000,'127.0.0.1',()=>console.log('Kindred is ready at http://localhost:3000'));
