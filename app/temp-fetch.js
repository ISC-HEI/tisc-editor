const https = require('https');
const url = 'https://raw.githubusercontent.com/typst/packages/main/packages/preview/isc-hei-bthesis/0.6.0/src/bachelor_thesis.typ';
https.get(url, res => {
  console.log('status', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk.toString());
  res.on('end', () => {
    console.log('length', data.length);
    console.log(data.slice(0,200));
  });
}).on('error', e => console.error('err', e));
