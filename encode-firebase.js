// encode-firebase.js
const fs = require('fs');

const json = fs.readFileSync('././config/celebridedriver-firebase-adminsdk-fbsvc-17b4ef76d5.json', 'utf8'); // Update the path if needed
const base64 = Buffer.from(json).toString('base64');
console.log(base64);
