const http = require('http');

const data = JSON.stringify({ content: "Hello everyone!" });

const options = {
    hostname: 'localhost',
    port: 8001,
    path: '/api/groups/group1/messages',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('Response:', body));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
