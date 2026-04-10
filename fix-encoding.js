const fs = require('fs');
const path = require('path');

function isGarbled(str) {
    if (str.length === 0) return false;
    // reconstruct
    const buf = Buffer.alloc(str.length * 2);
    for (let i = 0; i < str.length; i++) {
        buf.writeUInt16LE(str.charCodeAt(i), i * 2);
    }
    const reconstructed = buf.toString('utf8');
    
    // Check if reconstructed makes more sense
    let printable = 0;
    for(let i=0; i<reconstructed.length; i++) {
        const code = reconstructed.charCodeAt(i);
        if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
            printable++;
        }
    }
    
    let originalHighCharCount = 0;
    for(let i=0; i<str.length; i++) {
        if (str.charCodeAt(i) > 255) originalHighCharCount++;
    }
    
    return (printable / reconstructed.length > 0.90) && (originalHighCharCount / str.length > 0.05);
}

function traverseAndFix(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (let file of items) {
        if (file === 'node_modules' || file === '.git' || file === '.venv' || file === 'dist' || file === 'build') continue;
        const p = path.join(dir, file);
        if (fs.statSync(p).isDirectory()) {
            traverseAndFix(p);
        } else {
            const ext = path.extname(p);
            if (['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.yml', '.yaml', '.ps1', '.sql', '.txt'].includes(ext) || file.includes('Dockerfile') || file.includes('.env')) {
                try {
                    const str = fs.readFileSync(p, 'utf8');
                    if (isGarbled(str)) {
                        console.log('Fixing ' + p);
                        const buf = Buffer.alloc(str.length * 2);
                        for (let i = 0; i < str.length; i++) {
                            buf.writeUInt16LE(str.charCodeAt(i), i * 2);
                        }
                        let cleanStr = buf.toString('utf8');
                        // Remove trailing null bytes if length was odd
                        cleanStr = cleanStr.replace(/\x00+$/, '');
                        fs.writeFileSync(p, cleanStr, 'utf8');
                    }
                } catch(e) { }
            }
        }
    }
}

traverseAndFix(__dirname);
