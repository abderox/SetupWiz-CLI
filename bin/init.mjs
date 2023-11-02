
import { composePath, copyFile, getResources, getResourcesOut, isPathExist, readFile, replacePramWith } from '../utils/io.mjs';
import { getMavenVersion, getNodeVersion, getNpmVersion, isGitInstalled } from '../lib/commands/git-config.mjs';
import { drawLogo } from '../utils/logo.mjs';
import { readClear } from '../utils/crypto.mjs';
import dotenv from 'dotenv'

dotenv.config();

export async function init(version = "1.0.0") {
    const resourcePath = getResourcesOut();
    const resourceProjectPath = getResources();
    const cliFolderPath = composePath(resourcePath, 'cli');

    try {
        await copyFile(resourcePath, 'git-config.json');
    } catch (error) {
        await readClear(process.env.CRYPTO_PASSWORD || "", resourceProjectPath, resourcePath);
        await copyFile(resourcePath, 'git-config.json');
    }

    await copyFile(cliFolderPath, 'banner.txt');
    await copyFile(cliFolderPath, 'cli-description.txt');

    const gitVersion = await isGitInstalled();
    const nodeVersion = await getNodeVersion();
    const npmVersion = await getNpmVersion();
    const mvnVersion = await getMavenVersion();

    const bannerText = await readFile(composePath('cli', 'banner.txt'), true).catch(async () => await readFile('banner.txt'));
    const { title, ansi256 } = { title: bannerText?.split(',')[0]?.trim(), ansi256: bannerText?.split(',')[1]?.trim() }

    const logoBanner = (await drawLogo(title));
    const colorBanner = parseInt(ansi256 || '208');

    const cliDetails = await readFile(composePath('cli', 'cli-description.txt'), true).then((res) => {
        return replacePramWith("cli.version", version, res);
    }).catch(async () => await readFile('cli-description.txt'));

    return {
        resourcePath,
        cliFolderPath,
        gitVersion,
        nodeVersion,
        npmVersion,
        mvnVersion,
        logoBanner,
        colorBanner,
        cliDetails,
    };
}