// scripts/update-readme.js
const fs = require("fs");
const path = require("path");

// Read the updated version from package.json
const pkg = require("../package.json");
const version = pkg.version;

// Path to README.md
const readmePath = path.join(__dirname, "../README.md");
let readmeContent = fs.readFileSync(readmePath, "utf8");

// replace the pin {{version}} with the real version
readmeContent = readmeContent.replace(/v`{{version}}`/g, `v\`${version}\``);

// Save changes
fs.writeFileSync(readmePath, readmeContent);

const changelogPath = path.join(__dirname, "../CHANGELOG.md");
let changelogContent = fs.readFileSync(changelogPath, "utf8");

changelogContent = changelogContent.replace(/## \[Unreleased\]/, `## [Unreleased]\n\n## [${version}]`);

fs.writeFileSync(changelogPath, changelogContent);
