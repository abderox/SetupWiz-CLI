import { ask } from '../inquirer.mjs';
import { error, info, success } from '../logger.mjs';
import { getFilesIncludes, getHomeDir, mkdir, openDirectory, readFile, writeFile } from "../../utils/io.mjs";
import { gitClone, gitConfigUrl } from './clone.mjs';
import path from 'path';
import { switchBranches } from './git-config.mjs';
import { log } from 'console';
import { runApp } from './custom-commands.mjs';



export async function createNewEnvironment(customer = null) {
    const configString = await readFile('git-config.json', true).catch(async () => await readFile('git-config.json'));
    const existingConfig = configString && JSON.parse(configString);
    ask([
        {
            type: 'input',
            name: 'customer',
            message: 'Enter the customer name',
            default: customer || 'undefined'
        },
        {
            type: 'input',
            name: 'currentBranch',
            message: 'Enter the branch to pull from',
            default: 'release/standard',
        },
        {
            type: 'input',
            name: 'defaultBranch',
            message: 'Enter the default branch to pull from, in case of a fallback',
            default: 'release/standard',
        },
        {
            type: 'input',
            name: 'location',
            message: 'Enter the path to where to clone the repositories',
            default: getHomeDir(),
        }
    ])
        .then(async (answers) => {
            if (!answers.customer || answers.customer === 'undefined') {
                error('Customer name is required');
                return;
            }

            await mkdir(answers.location).then(() => process.chdir(answers.location)).catch(e => process.chdir(answers.location));
            await createNewConfig(existingConfig, answers).then(async r => await askForGitClone(r));
        })

}


export async function openAProjectDirectory(customer) {
    const fileName = await askWhichConfigFile(customer);

    const configToJson = fileName && JSON.parse(await readFile(fileName, true).catch(async () => await readFile('git-config.json')));

    if (!configToJson) {
        error('No config file found');
        return;
    }

    const pathDirectory = configToJson?.path;
    openDirectory(pathDirectory);
}

export async function chooseACustomer(customer) {

    const fileName = await askWhichConfigFile(customer);
    const configToJson = fileName && JSON.parse(await readFile(fileName, true).catch(async () => await readFile('git-config.json')));

    if (!configToJson) {
        error('No config file found');
        return;
    }

    const NO_BRANCH_SPECIFIED = '(no branch specified)';
    const checkout_to = `Checkout repositories to ${configToJson?.currentBranch || NO_BRANCH_SPECIFIED}`;
    const clone_to = `Clone repos to ${configToJson?.path}`;
    const run_frontend = 'Run frontend apps';
    const run_backend = 'Run backend apps';
    const build_apis = 'Build backend apis';
    const run_all = 'Run both backend and frontend';
    const install_frontend_deps = 'Install fronted dependencies';

    ask([
        {
            type: 'list',
            name: 'action',
            message: 'What do you want to do ?',
            choices: [
                'Create a new environment',
                clone_to,
                checkout_to,
                run_frontend,
                run_backend,
                run_all,
                build_apis,
                install_frontend_deps
            ]
        }])
        .then(async (answers) => {
            switch (answers.action) {
                case 'Create a new environment':

                    await createNewEnvironment(customer);
                    break;
                case clone_to:

                    fileName && fileName.length && await askForGitClone(fileName);
                    break;
                case checkout_to:

                    if (answers?.action?.includes(NO_BRANCH_SPECIFIED)) {
                        error('No branch specified in the config file');
                        return;
                    }

                    const failedRepos = switchBranches(configToJson?.path, configToJson?.currentBranch);
                    if (!failedRepos || failedRepos.length < 1) {
                        return;
                    }
                    info(`The following repos have not switched to ${configToJson?.currentBranch}`);
                    log('---------------------')
                    console.table(failedRepos);
                    await checkoutToDefaultOrChooseAnAction(configToJson, failedRepos);
                    break;

                case run_frontend:

                    await runApps(configToJson, "Frontend");
                    break;
                case run_backend:

                    await runApps(configToJson, "Backend");
                    break;
                case run_all:

                    await runApps(configToJson);
                    break;
            }
        })

}

async function runApps(existingConfig, typeRun = "All") {
    let backendRepos = [];
    let frontEndRepos = [];
    const failedToStart = [];
    const path = existingConfig?.path;

    switch (typeRun) {
        case "All":
            backendRepos = existingConfig?.run?.backEnd?.apps || [];
            frontEndRepos = existingConfig?.run?.frontEnd?.apps || [];
            break;
        case "Frontend":
            frontEndRepos = existingConfig?.run?.frontEnd?.apps || [];
            break;
        case "Backend":
            backendRepos = existingConfig?.run?.backEnd?.apps || [];
            break;
    }

    if (!backendRepos.length && !frontEndRepos.length) {
        error('No apps found');
        return;
    }

    try {

        if (backendRepos.length) {
            info(`Trying to run backend apps`);
            console.table(backendRepos);

            for (const repo of backendRepos) {
                runApp(path, repo, 'spring-boot', existingConfig).then(() => {
                    success(`App ${repo} is running`);
                }).catch(e => {
                    error('Error executing backend apps:', e);
                    failedToStart.push(repo)
                });
            }
        }

        if (frontEndRepos.length) {
            info(`Trying to run Frontend apps`);
            console.table(frontEndRepos);

            for (const repo of frontEndRepos) {
                runApp(path, repo, 'react', existingConfig).then(() => {
                    success(`App ${repo} is running`);
                }).catch(e => {
                    error('Error executing frontend apps:', e);
                    failedToStart.push(repo)
                });
            }
        }

        if (failedToStart.length) {
            info(`The following apps failed to start`);
            log('---------------------')
            console.table(failedToStart);
        }

    } catch (e) {
        error('Error running apps:', e);
    }


}


async function checkoutToDefaultOrChooseAnAction(config, failedRepos_) {
    const defaultBranch = config?.defaultBranch;
    const response = await ask([
        {
            type: 'list',
            name: 'checkout',
            message: `Do you want to checkout to the default branch ${defaultBranch} ?`,
            choices: ['Yes', 'No'],
        }
    ])
    if (response.checkout === "Yes") {
        const failedRepos = switchBranches(config?.path, defaultBranch, failedRepos_)
        if (!failedRepos || failedRepos.length < 1) {
            return;
        }
        info(`The following repos have not switched to ${defaultBranch}`);
        log('You would rather fix it manually');
        log('---------------------')
        console.table(failedRepos);
        return;
    }
    else {
        checkoutToASpecificBranch(config, failedRepos_);
    }
}


async function checkoutToASpecificBranch(config, failedRepos_) {
    const branchName = await ask([
        {
            type: 'input',
            name: 'branchName',
            message: 'Enter the branch name to checkout to ',
        }
    ])
    const failedRepos = switchBranches(config?.path, branchName?.branchName, failedRepos_)
    info(`The following repos have not switched to ${branchName?.branchName}`);
    log('You would rather fix it manually');
    log('---------------------')
    console.table(failedRepos);
    return;
}


async function createNewConfig(existingConfig, answers) {
    existingConfig.customer = answers.customer;
    existingConfig.currentBranch = answers.currentBranch;
    existingConfig.defaultBranch = answers.defaultBranch;
    existingConfig.path = answers.location;
    const currentBranch = answers?.currentBranch.replace(/[\/\\]/g, '-');
    const newConfigPath = `${answers.customer}-${currentBranch}-git-config.json`;
    return await writeFile(newConfigPath, JSON.stringify(existingConfig, null, 2), true);
}

async function gitCloneForAllTheRepositories(gitConfigFile) {
    const configToJson = gitConfigFile && JSON.parse(await readFile(path.basename(gitConfigFile), true).catch(async () => await readFile('git-config.json')))
    const backendRepos = configToJson?.repositories?.backEnd || [];
    const frontEndRepos = configToJson?.repositories?.frontEnd || [];
    const cloneOptions = configToJson?.cloneOptions || {};
    const cloneBackend = cloneOptions?.backEnd?.clone || false;
    const cloneFrontEnd = cloneOptions?.frontEnd?.clone || false;
    const allRepos = [];


    if (!cloneBackend && !cloneFrontEnd) {
        error('No repositories to clone');
        return;
    }

    if (cloneBackend && !backendRepos.length) {
        error('No backend repositories to clone');
        return;
    }

    if (cloneFrontEnd && !frontEndRepos.length) {
        error('No frontend repositories to clone');
        return;
    }

    if (cloneBackend) {
        console.table(backendRepos)
        allRepos.push(...backendRepos);
    }

    if (cloneFrontEnd) {
        console.table(frontEndRepos)
        allRepos.push(...frontEndRepos);
    }

    try {

        await Promise.all(allRepos.map(async (repoUrl) => {
            const gitCloneUrl = gitConfigUrl(configToJson, repoUrl);
            await gitClone(gitCloneUrl, configToJson?.path);
        })).then(() => success(`All repositories cloned successfully to ${configToJson?.path}`)).catch(e => {
            error('Error cloning repositories:', e);
        })

    } catch (e) {
        error('Error cloning repositories:', e);
    }
}

async function askForGitClone(configFilePath) {
    const response = await ask([
        {
            type: 'list',
            name: 'cloneRepositories',
            message: `Do you want to git clone the repositories ?, please take a look at the config file :\n ${configFilePath} \n`,
            choices: ['Yes', 'Later'],
        }
    ]);
    if (response.cloneRepositories === "Yes") {
        await gitCloneForAllTheRepositories(configFilePath);
    }
}


async function askWhichConfigFile(customer) {
    const fileNames = await getFilesIncludes(customer);

    if (fileNames.length < 1) {
        return null;
    }

    const response = await ask([
        {
            type: 'list',
            name: 'config',
            message: 'Please choose which customer based on the following found configs.',
            choices: fileNames
        }
    ]);

    return response?.config;

}

