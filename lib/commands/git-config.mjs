import { error, info } from '../logger.mjs';
import { composePath, copyFile, duplicateFile, getResourcesOut, isPathExist, readFile, writeFile } from "../../utils/io.mjs";
import { exec, execSync } from 'child_process';
import fs from 'fs';
import { log } from 'console';
import path from 'path';



export async function updateGitConfig(arg, parameter) {
    try {
        const configString = await readFile('git-config.json', true).catch(async () => await readFile('git-config.json'));
        const config = JSON.parse(configString);

        if (config && config[parameter]) {
            info(`Trying to update ${config[parameter]} to ${arg}`)
            config[parameter] = arg;
            await writeFile('git-config.json', JSON.stringify(config, null, 2), true);
        }
    } catch (e) {
        error('Error updating git-config:', e);
    }
}

export async function isGitInstalled() {
    return new Promise((resolve, reject) => {
        exec('git --version', (error, stdout, stderr) => {
            if (error) {
                error('Git is not installed.');
                process.exit(1)
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

export async function getNodeVersion() {
    return new Promise((resolve, reject) => {
        exec('node -v', (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

export async function getNpmVersion() {
    return new Promise((resolve, reject) => {
        exec('npm -v', (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

export async function getMavenVersion() {
    return new Promise((resolve, reject) => {
        exec('mvn -v', (error, stdout, stderr) => {
            if (error) {
                resolve('undefined')
            } else {
                const versionMatch = stdout.match(/Apache Maven (\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    resolve(versionMatch[1]);
                } else {
                    resolve('Undefined');
                }
            }
        });
    });
}


export function listGitRepositories(directory_, verbose = false) {

    let directory = directory_ && directory_.trim();
    let message = null;

    if (directory === '.') {
        directory = process.cwd();
        log(directory)
    }

    if (directory.startsWith('.') && directory.length > 1) {
        directory = directory.replace('./', '');
        directory = composePath(process.cwd(), directory);
    }


    if (!isPathExist(directory)) {
        error(`The directory ${directory} does not exist`);
        return;
    }



    const repos = [];


    if (fs.existsSync(`${directory}/.git`)) {
        message = '_';
        info('This directory is a repository itself')
        repos.push(path.basename(directory));
    }
    else {
        repos.push(...fs.readdirSync(directory));
    }

    const output = [];

    for (const repo of repos) {

        let repoPath = `${directory}/${repo}`;

        if (fs.existsSync(`${directory}/.git`)) {
            repoPath = directory;
        }


        if (!fs.statSync(repoPath).isDirectory() || !fs.existsSync(`${repoPath}/.git`)) {
            continue;
        }

        const repoName = repo;

        try {
            process.chdir(repoPath);

            const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();

            output.push({ name: repoName, branch: currentBranch });

            process.chdir(directory);
        } catch (e) {
            error(`Error processing repository ${repoName}: ${e.message}`);
        }
    }

    if (verbose) {
        return {
            output,
            message
        }
    }
    return output;
}


export function switchBranches(directory_, branchName, failedRepos_ = null, verbose = true) {
    let directory = directory_;

    if (directory === '.') {
        directory = process.cwd();
    }

    if (directory.startsWith('.') && directory.length > 1) {
        directory = directory.replace('./', '');
        directory = composePath(process.cwd(), directory);
    }


    if (!isPathExist(directory)) {
        error(`The directory ${directory} does not exist`);
        return;
    }


    const failedRepos = [];
    const repos = [];

    if (failedRepos_ && failedRepos_?.length) {
        repos.push(...failedRepos_);
    }
    else {

        if (fs.existsSync(`${directory}/.git`)) {
            if (verbose) {
                info('This directory is a repository itself')
            }
            repos.push(path.basename(directory));
        }
        else {
            repos.push(...fs.readdirSync(directory));
        }

    }

    if (repos.length < 1) {
        error(`No repository found in ${directory}`);
        return;
    }


    for (const repo of repos) {
        let repoPath = `${directory}/${repo}`;

        if (fs.existsSync(`${directory}/.git`)) {
            repoPath = directory;
        }

        if (!fs.statSync(repoPath).isDirectory() || !fs.existsSync(`${repoPath}/.git`)) {
            error(`** ${repo}/ is not a repository **`)
            continue;
        }

        const repoName = repo;

        try {
            process.chdir(repoPath);

            try {
                execSync(`git checkout ${branchName}`);
            } catch (e) {
                failedRepos.push(repoName);
                error(`Error switching branch for repository ${repoName}: ${e.message}`);
            }

            process.chdir(directory);
        } catch (e) {
            error(`Error processing repository ${repoName}: ${e.message}`);
        }
    }

    return failedRepos;
}


export function switchBranchesToTheExportConfig(configJson) {
    const exported = configJson?.exported;


    if (!Array.isArray(exported)) {
        throw new Error('No exported repositories found in the configuration file');
    }


    for (const repo of exported) {
        const { name, branch } = repo;
        info(`Repo : ${name} -- Trying to checkout to ${branch}`)
        const failedRepos = switchBranches(composePath(configJson?.path, name), branch, null, false);
        if (failedRepos?.length) {
            error(`Failed to switch branch for the following repositories: ${failedRepos.join(', ')}`);
        }
    }
}


export function importConfig(src) {

    if (!isPathExist(src)) {
        error('Can not find the path')
        return;
    }

    const fileName = path.basename(src);
    const src_ = src.replace(fileName, '');

    info(`Importing config file '${fileName}' from ${src_} to ${getResourcesOut()}`)

    copyFile(getResourcesOut(), fileName, src_);

}
