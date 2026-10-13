const http = require('http');

const url = 'http://localhost:8081/node_modules%5Cexpo%5CAppEntry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app';

http.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', data.slice(0, 2000));
  });
}).on('error', (err) => {
  console.error('ERROR:', err.message);
});
