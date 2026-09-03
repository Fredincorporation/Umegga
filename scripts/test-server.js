import http from 'http';

function check() {
  http.get('http://localhost:4173', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log('Status code:', res.statusCode);
      console.log('HTML length:', data.length);
      console.log('Contains root div:', data.includes('id="root"'));
      console.log('Contains Umegga title:', data.includes('Umegga'));
    });
  }).on('error', (err) => {
    console.error('Error connecting to preview:', err.message);
  });
}

check();
