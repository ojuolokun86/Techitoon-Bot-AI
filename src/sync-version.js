const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const versionFilePath = path.join(__dirname, 'version.js');

const versionContent = `
const version = "${packageJson.version}";

function getVersion() {
    return version;
}

module.exports = { getVersion };
`;

fs.writeFileSync(versionFilePath, versionContent.trim());
console.log(`Version synced to ${packageJson.version} in version.js`);