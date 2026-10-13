const fs = require('fs');
const path = require('path');

const manifest = {
  name: 'Frutería Steve',
  short_name: 'Steve',
  description: 'PWA para catalogo, pedidos, caja e inventario de Frutería Steve.',
  start_url: '/',
  display: 'standalone',
  background_color: '#f5f7f1',
  theme_color: '#17803d',
  icons: [
    { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
  ],
};

const manifestDir = path.join(__dirname, 'public');
if (!fs.existsSync(manifestDir)) fs.mkdirSync(manifestDir, { recursive: true });
fs.writeFileSync(path.join(manifestDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(manifestDir, 'icon.svg'), `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="#17803d"/>
  <circle cx="64" cy="64" r="30" fill="#f7d66a"/>
  <path d="M64 22c14 0 25 11 25 25v5h-10v-5c0-8-7-15-15-15s-15 7-15 15v5H39v-5c0-14 11-25 25-25z" fill="#f0f5ef"/>
  <path d="M40 58h48c7 0 13 6 13 13v18c0 7-6 13-13 13H40c-7 0-13-6-13-13V71c0-7 6-13 13-13z" fill="#f0f5ef"/>
  <path d="M50 82h28v7H50zM48 95h32v7H48z" fill="#17803d"/>
</svg>
`);
