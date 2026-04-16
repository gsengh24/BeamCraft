const fs = require('fs');
const https = require('https');
const path = require('path');

const dataFile = path.join(__dirname, 'data', 'products.json');
const scriptFile = path.join(__dirname, 'public', 'script.js');
const imagesDir = path.join(__dirname, 'public', 'images', 'products');

function fetchImage(url, filename) {
    return new Promise((resolve, reject) => {
        const match = url.match(/\/d\/([^=]+)/);
        const fileId = match ? match[1] : null;

        if (!fileId) return resolve(false);
        
        const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

        const req = https.get(driveUrl, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                https.get(res.headers.location, (redirectRes) => {
                    const fileStream = fs.createWriteStream(filename);
                    redirectRes.pipe(fileStream);
                    fileStream.on('finish', () => resolve(true));
                    fileStream.on('error', reject);
                }).on('error', reject);
            } else if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(filename);
                res.pipe(fileStream);
                res.on('end', () => resolve(true));
                fileStream.on('error', reject);
            } else {
                resolve(false);
            }
        });
        req.on('error', reject);
    });
}

async function process() {
    let products = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    let scriptContent = fs.readFileSync(scriptFile, 'utf8');

    const downloadQueue = new Set();
    const urlMap = {};

    for (let p of products) {
        if (p.image && p.image.includes('google')) downloadQueue.add(p.image);
        if (p.images) {
            p.images.forEach(img => {
                if (img.includes('google')) downloadQueue.add(img);
            });
        }
    }

    const imgRegex = /https:\/\/lh3\.googleusercontent\.com\/d\/([^=]+)=w400/g;
    let match;
    while ((match = imgRegex.exec(scriptContent)) !== null) {
        downloadQueue.add(match[0]);
    }

    const queue = Array.from(downloadQueue);
    console.log(`Processing ${queue.length} images...`);

    const promises = queue.map(async (url) => {
        const idMatch = url.match(/\/d\/([^=]+)/);
        if (!idMatch) return;
        const fileId = idMatch[1];
        const filename = `img_${fileId}.jpg`;
        const filepath = path.join(imagesDir, filename);
        
        urlMap[url] = `images/products/${filename}`;
        
        if (!fs.existsSync(filepath) || fs.statSync(filepath).size === 0) {
            try {
                await fetchImage(url, filepath);
            } catch (e) {
                console.error(`Error downloading ${url}`);
            }
        }
    });

    await Promise.all(promises);

    let productsString = JSON.stringify(products);
    for (const [orig, local] of Object.entries(urlMap)) {
        productsString = productsString.split(orig).join(local);
        scriptContent = scriptContent.split(orig).join(local);
    }
    
    fs.writeFileSync(dataFile, productsString);
    fs.writeFileSync(scriptFile, scriptContent);
    console.log("Done!");
}

process();
