import { ask } from '../inquirer.mjs';
import { custom, error, info, log, success } from '../logger.mjs';
import { getFilesIncludes, getHomeDir, mkdir, openDirectory, readFile, writeFile } from "../../utils/io.mjs";
import { gitClone, gitConfigUrl } from './clone.mjs';
import path from 'path';
import { listGitRepositories, switchBranches, switchBranchesToTheExportConfig } from './git-config.mjs';
import { installDepsOno, runApp } from './custom-commands.mjs';



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

            await mkdir(answers.location).then(() => process.chdir(answers.location)).catch(() => process.chdir(answers.location));
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
    const checkout_to_exported_config = 'Checkout branches according to the exported config';
    const clone_to = `Clone repos to ${configToJson?.path}`;
    const run_frontend = 'Run frontend apps';
    const run_backend = 'Run backend apps (Beta)';
    const build_apis = 'Build backend apis';
    const run_all = 'Run both backend and frontend';
    const install_frontend_deps = 'Install fronted dependencies';
    const export_repos = 'Export repos with branches to the config file'

    const choices = [
        'Create a new environment',
        clone_to,
        checkout_to,
        run_frontend,
        run_backend,
        build_apis,
        install_frontend_deps,
        export_repos,
    ]

    if (configToJson?.exported && configToJson?.exported?.length && configToJson?.exported?.length > 0) {
        choices.push(checkout_to_exported_config);
    }

    ask([
        {
            type: 'list',
            name: 'action',
            message: 'What do you want to do ?',
            choices
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

                case export_repos:

                    await exportRposWithBranches(configToJson, fileName)
                    break;

                case checkout_to_exported_config:

                    switchBranchesToTheExportConfig(configToJson);
                    break;

                case run_frontend:

                    await runApps(configToJson, "Frontend");
                    break;

                case run_backend:

                    await runApps(configToJson, "Backend");
                    break;

                case build_apis:

                    await installDeps(configToJson, "Backend");
                    break;

                case install_frontend_deps:

                    await installDeps(configToJson, "Frontend");
                    break;
            }
        })

}

async function runApps(existingConfig, typeRun = "All") {
    let backendRepos = [];
    let frontEndRepos = [];
    let runAll = [];
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


            const backEndPromises = backendRepos.map(async (repo) => {
                try {
                    await runApp(path, repo, 'spring-boot', existingConfig);
                    success(`App ${repo} is running`);

                } catch (e) {
                    error('Error executing backend apps:', e);
                    failedToStart.push(repo);
                }
            });

            runAll.push(...backEndPromises);
        }

        if (frontEndRepos.length) {
            info(`Trying to run Frontend apps`);
            console.table(frontEndRepos);

            const frontEndPromises = frontEndRepos.map(async (repo) => {
                try {
                    await runApp(path, repo, 'react', existingConfig);
                    success(`App ${repo} is running`);


                } catch (e) {
                    error('Error executing frontend apps:', e);
                    failedToStart.push(repo)
                }
            });

            runAll.push(...frontEndPromises);
        }

        await Promise.all(runAll);

        if (failedToStart.length) {
            info(`The following apps failed to start`);
            log('---------------------')
            console.table(failedToStart);
        }

    } catch (e) {
        error('Error running apps:', e);
    }


}


async function installDeps(existingConfig, typeBuild) {
    let backendRepos = [];
    let frontEndRepos = [];
    const failedToInstall = [];
    const path = existingConfig?.path;

    switch (typeBuild) {

        case "Frontend":
            frontEndRepos = existingConfig?.install?.frontEnd?.apps || [];
            break;
        case "Backend":
            backendRepos = existingConfig?.install?.backEnd?.apps || [];
            break;
    }

    if (!backendRepos.length && !frontEndRepos.length) {
        error('No apps found');
        return;
    }

    try {

        if (backendRepos.length) {
            info(`Trying to install dependencies, backend apps`);
            console.table(backendRepos);

            for (const repo of backendRepos) {
                try {
                    await installDepsOno(path, repo, 'spring-boot', existingConfig);
                    success(`App ${repo} is done`);
                } catch (e) {
                    error('Error building backend app:', e);
                    failedToInstall.push(repo);
                }
            }
        }

        if (frontEndRepos.length) {
            info(`Trying to install dependencies, Frontend apps`);
            console.table(frontEndRepos);

            for (const repo of frontEndRepos) {

                try {
                    await installDepsOno(path, repo, 'react', existingConfig);
                    success(`App ${repo} is done`);
                } catch (e) {
                    error('Error building frontend app:', e);
                    failedToInstall.push(repo);
                }
            }
        }

        if (failedToInstall.length) {
            info(`The following apps failed to start`);
            log('---------------------')
            console.table(failedToInstall);
        }

    } catch (e) {
        error('Error installing dependencies:', e);
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

    let directory = answers.location;

    if (directory === '.') {
        directory = process.cwd();
    }

    if (directory.startsWith('.') && directory.length > 1) {
        directory = directory.replace('./', '').replace('.\\', '');
        directory = composePath(process.cwd(), directory);
    }

    existingConfig.path = directory;
    const currentBranch = answers?.currentBranch.replace(/[\/\\]/g, '-');
    const newConfigPath = `${answers.customer}-${currentBranch}-git-config.json`;
    return await writeFile(newConfigPath, JSON.stringify(existingConfig, null, 2), true);
}

async function gitCloneForAllTheRepositories(gitConfigFile) {
    const configToJson = gitConfigFile && JSON.parse(await readFile(path.basename(gitConfigFile), true).catch(async () => await readFile('git-config.json')))
    const backendRepos = configToJson?.repositories?.backEnd || [];
    const frontEndRepos = configToJson?.repositories?.frontEnd || [];
    const exportedRepos = configToJson?.exported || [];
    const cloneOptions = configToJson?.cloneOptions || {};
    const cloneBackend = cloneOptions?.backEnd?.clone || false;
    const cloneFrontEnd = cloneOptions?.frontEnd?.clone || false;
    const allRepos = [];

    error(`\n **********  This is your config : Username ${configToJson?.username}, GitVCS: ${configToJson?.gitVCS} *********** \n`)

    if (exportedRepos.length) {
        if (!exportedRepos.every(item => item && item.name)) {
            return;
        }
        const repos = exportedRepos.map(item => item?.name);
        console.table(repos);
        allRepos.push(...repos);
    } else {

        if (!cloneBackend && !cloneFrontEnd) {
            error('No repositories to clone');
            return;
        }


        if (cloneBackend && backendRepos.length) {
            console.table(backendRepos)
            allRepos.push(...backendRepos);
        }
        else {
            error('No backend repositories to clone');
        }

        if (cloneFrontEnd && frontEndRepos.length) {
            console.table(frontEndRepos)
            allRepos.push(...frontEndRepos);
        }
        else {
            error('No frontend repositories to clone');
        }
    }


    for (const repo of allRepos) {
        const gitCloneUrl = gitConfigUrl(configToJson, repo);

        try {
            await gitClone(gitCloneUrl, configToJson?.path, repo);
            success(`Repository cloned successfully to ${configToJson?.path}`);

        } catch (err) {
            error('Error cloning repository', err);
        }
    }

}

async function askForGitClone(configFilePath) {
    const response = await ask([
        {
            type: 'list',
            name: 'cloneRepositories',
            message: `Do you want to git clone the repositories ?, please take a look at the config file before proceeding :\n ${configFilePath} \n`,
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


export async function exportRposWithBranches(configToJson_, fileName) {
    let configToJson = configToJson_;
    const exported = listGitRepositories(configToJson?.path, true);


    if (Object.keys(exported).includes('message') && exported?.message === '_') {
        const { branch } = exported.output[0];
        configToJson.exported = [{
            name: '',
            branch
        }]
    }


    else {
        configToJson.exported = exported.output;

        const backEndRepos = configToJson?.repositories?.backEnd || [];
        const frontEndRepos = configToJson?.repositories?.frontEnd || [];
        const exportedRepos = configToJson?.exported || [];
        const unfoundedRepos = []


        for (let i = 0; i < backEndRepos.length; i++) {
            if (!exportedRepos.some(r => r.name === backEndRepos[i])) {
                custom(
                    `\n-- ${backEndRepos[i]} is not found. Removed from backend repositories --`, 208
                )
                backEndRepos.splice(i, 1);
            }
        }

        for (let i = 0; i < frontEndRepos.length; i++) {
            if (!exportedRepos.some(r => r.name === frontEndRepos[i])) {
                custom(
                    `\n-- ${frontEndRepos[i]} is not found. Removed from frontend repositories -- \n`, 208
                )
                frontEndRepos.splice(i, 1);
            }
        }

        for (let i = 0; i < exportedRepos.length; i++) {
            if (![...backEndRepos, ...frontEndRepos].some(r => r === exportedRepos[i]?.name)) {
                unfoundedRepos.push(exportedRepos[i]?.name)
            }
        }

        if (unfoundedRepos.length) {
            info(`The following repos were not found in the config file , add them manually to the 'repositories'`);
            log('---------------------')
            console.table(unfoundedRepos);
        }

    }



    await writeFile(fileName, JSON.stringify(configToJson, null, 2), true);
}

