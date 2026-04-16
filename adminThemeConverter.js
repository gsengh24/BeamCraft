const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'admin', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const replacements = {
  // Theme Variables
  '--bg-primary: #0a0a14;': '--bg-primary: #f6f8fb;',
  '--bg-secondary: #141428;': '--bg-secondary: #ffffff;',
  '--bg-card: #1c1c34;': '--bg-card: #ffffff;',
  '--text-primary: #ffffff;': '--text-primary: #2d2d2d;',
  '--text-secondary: #a0a0c0;': '--text-secondary: #555555;',
  '--text-muted: #6060a0;': '--text-muted: #888888;',
  '--border: rgba(255,255,255,0.08);': '--border: rgba(0,0,0,0.1);',
  '--accent: #e94560;': '--accent: #FFCA28;', // Golden 
  '--accent-2: #ff6b35;': '--accent-2: #FFB300;',
  
  // Specific backgrounds
  'background: linear-gradient(135deg, #e94560, #ff6b35);': 'background: linear-gradient(135deg, #FFCA28, #FFB300);',
  'color: #fff': 'color: #2d2d2d',
  'color:#fff': 'color:#2d2d2d',
  'box-shadow: 0 4px 20px rgba(0,0,0,0.4);': 'box-shadow: 0 4px 20px rgba(0,0,0,0.06);',
  'background: var(--bg-card);': 'background: var(--bg-card); box-shadow: 0 2px 10px rgba(0,0,0,0.05);',
};

for (const [oldVal, newVal] of Object.entries(replacements)) {
  css = css.split(oldVal).join(newVal);
}

fs.writeFileSync(cssPath, css);
console.log('Admin CSS Theme updated successfully.');
