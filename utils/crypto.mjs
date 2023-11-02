import { createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';
import { composePath, duplicateFile, readFile, removeFile, writeFile } from './io.mjs';
import { custom, error } from '../lib/logger.mjs';
import { ask } from '../lib/inquirer.mjs';



const algorithm = 'aes-192-cbc';
const iv = Buffer.alloc(16, 0);


export async function encrypt(text, password, path) {

    const key = scryptSync(password, 'salt', 24);

    const cipher = createCipheriv(algorithm, key, iv);

    let encryptedText = cipher.update(text, 'utf8', 'hex');
    encryptedText += cipher.final('hex');

    await writeFile(path, encryptedText.trim(), false, false);
}


export async function decryptIt(password, text) {

    const key = scryptSync(password, 'salt', 24);

    const decipher = createDecipheriv(algorithm, key, iv);

    let decrypted = decipher.update(text, 'hex', 'utf8');

    decrypted += decipher.final('utf8');

    return decrypted;
}

async function getPassword() {
    let password;

    try {
        password = await readFile('.$$');
    } catch (err) {
        error('Please set the password to the variable CRYPTO_PASSWORD or insert it below');
        custom('Either way, a default configuration will be generated',205)

        const newPass = await ask({
            type: 'password',
            name: 'password',
            message: 'Enter the password',
        });

        password = newPass.password;
        await writeFile('.$$', password, false, false);
    }

    return password;
}

async function decryptAndSaveConfig(password) {
    const te = await readFile('--');
    const decrypted = await decryptIt(password, te);

    const configJson = JSON.stringify(JSON.parse(decrypted), null, 2);
    await writeFile('git-config.json', configJson, false, false); 
}

export async function readClear(password_, resourceProjectPath = null, resourcePath = null) {
    let password = password_;

    if (!password) {
        password = await getPassword();
    }

    try {
        await decryptAndSaveConfig(password);
    } catch (err) {
        error('Wrong password. We will generate you the default config file');
        await removeFile(composePath(resourceProjectPath, '.$$'))
        await duplicateFile(composePath(resourceProjectPath, 'default.json'), composePath(resourceProjectPath, 'git-config.json'));
    }
}





