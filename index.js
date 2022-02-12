#! /usr/bin/env node

const fs = require("fs");
const readline = require("readline");
const util = require('util');
const exec = util.promisify(require("child_process").exec);
const mkdir = util.promisify(fs.mkdir);
const path = require("path");
const crypto = require("crypto");
const ALGO = "aes-256-ctr";

function exit(msg) {
  if (msg) {
    process.stderr.write(`\x1b[31m${msg}\n\x1b[0m`);
  }
  process.exit(!!msg);
}

function encryptBlock(val, key, iv) {
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  let encrypted = cipher.update(val, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decryptBlock(val, key, iv) {
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  let decrypted = decipher.update(val, 'base64', 'utf8');
  return (decrypted + decipher.final('utf8'));
}

const funcMap = {
  clean: encryptBlock,
  smudge: decryptBlock,
}

async function getConfigPath() {
  try {
    const { stdout } = await exec("git rev-parse --git-dir");
    return stdout.replace('\n', '');
  } catch(e) {
    return exit(e.message)
  }
}

function getDirPath(gitConfigPath) {
  return `${gitConfigPath}/git-privatize`;
}

// NOTE: if we've already initialized git-privatize, don't overwrite
// our key
async function assertNotInitialized(gitConfigPath) {
  try {
    const initialized = fs.existsSync(getDirPath(gitConfigPath));
    if (initialized) {
      return exit("Error: this repo has already initialized git-privatize")
    }
  } catch(e) {
    return exit(e.message)
  }
}

async function createKeyAndIV(gitConfigPath) {
  try {
    await mkdir(getDirPath(gitConfigPath));
    // NOTE: aes-256 should have 256B key length. we use the first 32
    // bytes as the key and the next 16 as the initialization vector
    const keyAndIV = crypto.randomBytes(48);
    fs.writeFileSync(`${getDirPath(gitConfigPath)}/key`, keyAndIV);
  } catch(e) {
    exit(e.message);
  }
}

async function copyKey(keyPath, gitConfigPath) {
  try {
    const gitPrivatizePath = getDirPath(gitConfigPath);
    await mkdir(gitPrivatizePath);
    fs.copyFileSync(keyPath, `${gitPrivatizePath}/key`);
  } catch(e) {
    exit(e.message);
  }
}

async function resetHeadHard() {
  try {
    await exec("git reset --hard");
  } catch(e) {
    exit(e.message);
  }
}

async function unlock(keyFile) {
  try {
    const gitConfigPath = await getConfigPath();
    await assertNotInitialized(gitConfigPath);
    if (!keyFile) {
      return exit("Error: provide the key to decrypt encrypted files");
    }
    const keyExists = fs.existsSync(keyFile);
    if (!keyExists) {
      return exit("Error: provide the key to decrypt encrypted files");
    }
    await addGitFilters();
    await copyKey(keyFile, gitConfigPath);
    await resetHeadHard();
  } catch(e) {
    exit(e.message);
  }
}

function privatizeStream(cmd, readStream, noop) {
  return new Promise(async (resolve) => {
    const gitConfigPath = await getConfigPath();
    const keyAndIV = fs.readFileSync(`${getDirPath(gitConfigPath)}/key`);
    const key = keyAndIV.slice(0,32); // first 32B are the key
    const iv = keyAndIV.slice(32,48); // next 16B are the IV
    let currentBlockIsProtected = false;
    let heredocIndex = 0;
    let lineNumber = 0;
    let outputLines = {}; // { 0: 'some text', ... [x]: "some more text. <<PRIVATE", [x+1]: "" }
    let privatizeQueue = [];

    const rl = readline.createInterface({
      input: readStream || process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', async function(line){
      if (line.endsWith("<<PRIVATE")) {
        outputLines[lineNumber] = line;
        currentBlockIsProtected = true;
        privatizeQueue.push({ raw: [], lineNumber: lineNumber + 1 });
      } else if (currentBlockIsProtected) {
        if (line.startsWith("PRIVATE")) {
          outputLines[lineNumber] = `${line}`;
          currentBlockIsProtected = false;
          heredocIndex++;
        } else {
          privatizeQueue[heredocIndex].raw.push(line);
        }
      } else {
        outputLines[lineNumber] = line;
      }
      lineNumber++;
    })

    rl.on('close', async function() {
      if (currentBlockIsProtected) {
        exit("Error: git-privatize's HEREDOC (<<PRIVATE) was opened but not closed.");
      } else {
        const cmdFunc = funcMap[cmd];
        for (data of privatizeQueue) {
          if (!cmdFunc) { // diff
            outputLines[data.lineNumber] = data.raw.join('\n');
          } else {
            outputLines[data.lineNumber] = await cmdFunc(data.raw.join('\n'), key, iv);
          }
        }
        for (let i = 0; i <= lineNumber; i++) {
          if (outputLines.hasOwnProperty(i)) {
            process.stdout.write(`${outputLines[i]}\n`);
          }
        }
        resolve();
      }
    });
  });
}

async function addGitFilters() {
  await exec("git config filter.git-privatize.smudge '\"git-privatize\" smudge'");
  await exec("git config filter.git-privatize.clean '\"git-privatize\" clean'");
  await exec("git config diff.git-privatize.textconv '\"git-privatize\" diff'");
  await exec("git config filter.git-privatize.required true");
}

async function init() {
  const gitConfigPath = await getConfigPath();
  await assertNotInitialized(gitConfigPath);
  await createKeyAndIV(gitConfigPath);
  await addGitFilters()
}

function help() {
  console.log(`
Usage: git-privatize COMMAND [ARGS ...]

Commands:
  init                 generate a key and prepare repo to use git-privatize
  export FILENAME      export this repo's symmetric key to the given file
  unlock KEYFILE       decrypt this repo using the given symmetric key

See 'git-privatize help COMMAND' for more information on a specific command.
`);
}

(async () => {
  const cmd = process.argv[2];
  if (['clean', 'smudge'].indexOf(cmd) > -1) {
    await privatizeStream(cmd);
    exit();
  } else if (cmd === 'init') {
    await init();
    exit();
  } else if (cmd === 'unlock') {
    const keyFile = process.argv[3];
    await unlock(keyFile);
    exit();
  } else if (cmd === 'diff') {
    const diffFile = process.argv[3];
    const newFile = diffFile.startsWith('/');
    const diffReadStream = fs.createReadStream(diffFile);
    await privatizeStream("diff", diffReadStream);
    exit();
  } else if (cmd == 'export') {
    const fileName = process.argv[3];
    if (!fileName) {
      exit("Error: export filename not provided");
    }
    const gitConfigPath = await getConfigPath();
    fs.copyFileSync(`${getDirPath(gitConfigPath)}/key`, fileName);
    exit()
  } else {
    help()
    exit();
  }
})();