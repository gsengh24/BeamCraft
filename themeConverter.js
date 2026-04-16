const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'public', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const replacements = {
  // Theme Variables
  '--bg-primary: #0a0a14;': '--bg-primary: #ffffff;',
  '--bg-secondary: #0f0f1f;': '--bg-secondary: #f8f9fa;',
  '--bg-card: #141428;': '--bg-card: #ffffff;',
  '--bg-glass: rgba(255,255,255,0.04);': '--bg-glass: rgba(255,255,255,0.8);',
  '--accent: #e94560;': '--accent: #FFCA28;', // Logo Yellow
  '--accent-2: #ff6b35;': '--accent-2: #FFB300;', // Logo Yellow Darker
  '--accent-glow: rgba(233,69,96,0.3);': '--accent-glow: rgba(255, 202, 40, 0.3);',
  '--gold: #f5c842;': '--gold: #FFCA28;',
  '--text-primary: #f0f0ff;': '--text-primary: #2d2d2d;', // Logo Charcoal
  '--text-secondary: #a0a0c0;': '--text-secondary: #555555;',
  '--text-muted: #6060a0;': '--text-muted: #888888;',
  '--border: rgba(255,255,255,0.08);': '--border: rgba(0,0,0,0.1);',
  '--border-accent: rgba(233,69,96,0.3);': '--border-accent: rgba(255, 202, 40, 0.4);',
  '--shadow: 0 8px 32px rgba(0,0,0,0.4);': '--shadow: 0 8px 32px rgba(0,0,0,0.08);',
  '--shadow-glow: 0 0 40px rgba(233,69,96,0.2);': '--shadow-glow: 0 0 40px rgba(255, 202, 40, 0.2);',

  // Raw CSS Hardcodes
  '#e94560': '#FFCA28',
  'rgba(233,69,96,': 'rgba(255, 202, 40,',
  '#ff6b35': '#FFB300',
  'rgba(255,107,53,': 'rgba(255, 179, 0,',
  '#f5c842': '#FFCA28',
  
  // Specific Backgrounds
  'background: rgba(10,10,20,0.95);': 'background: rgba(255,255,255,0.95);',
  'background: rgba(10,10,20,0.98);': 'background: rgba(255,255,255,0.98);',
  'background: rgba(10,10,20,0.97);': 'background: rgba(255,255,255,0.97);',
  'background: rgba(20,20,40,0.9);': 'background: rgba(255,255,255,0.9);',
  
  // Button text
  'color: #fff;': 'color: #2d2d2d;'
};

for (const [oldVal, newVal] of Object.entries(replacements)) {
  css = css.split(oldVal).join(newVal);
}

// Special fixes for elements that really need white text
css = css.replace('.badge-new { background: rgba(0,204,136,0.9); color: #2d2d2d; }', '.badge-new { background: rgba(0,204,136,0.9); color: #ffffff; }');
css = css.replace('.badge-bestseller { background: rgba(255, 202, 40,0.9); color: #2d2d2d; }', '.badge-bestseller { background: rgba(255, 202, 40,0.9); color: #2d2d2d; }');
css = css.replace('.badge-year { display: block; font-size: 2rem; font-weight: 900; color: #2d2d2d; }', '.badge-year { display: block; font-size: 2rem; font-weight: 900; color: #ffffff; }');
css = css.replace('.btn-full { width: 100%; justify-content: center; }', '.btn-full { width: 100%; justify-content: center; }\n.btn-primary { color: #2d2d2d !important; font-weight: 800; }');


fs.writeFileSync(cssPath, css);
console.log('CSS Theme updated successfully to match logo.');
