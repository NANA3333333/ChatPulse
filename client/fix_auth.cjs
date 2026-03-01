const fs = require('fs');
const path = require('path');

const files = [
    path.join(__dirname, 'src', 'components', 'ChatWindow.jsx'),
    path.join(__dirname, 'src', 'components', 'GroupChatWindow.jsx')
];

for (const f of files) {
    let content = fs.readFileSync(f, 'utf-8');

    // 1. Inject into existing headers
    content = content.replace(/headers:\s*{\s*'Content-Type'/g, "headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}`, 'Content-Type'");

    // 2. Replace simple single-argument fetch calls (e.g. GET requests)
    // Regex matches fetch(`...`) or fetch('...') without a second argument.
    content = content.replace(/fetch\((`[^`]+`|'[^']+'|"[^"]+")\)/g, "fetch($1, { headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } })");

    // 3. Replace fetch(..., { method: 'DELETE' }) which lacks headers
    content = content.replace(/method:\s*'DELETE'\s*}/g, "method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }");

    // 4. Any other fetch cases that might lack headers and only have method?
    content = content.replace(/method:\s*'POST'\s*}/g, "method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('cp_token') || ''}` } }");

    fs.writeFileSync(f, content, 'utf-8');
    console.log(`Updated ${path.basename(f)}`);
}
