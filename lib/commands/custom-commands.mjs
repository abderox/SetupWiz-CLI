import { ask } from '../inquirer.mjs';
import { error, info, log, success } from '../logger.mjs';
import { composePath, getHomeDir, getResources, readFile, removeFile, removeFolderRecursively, writeFile } from "../../utils/io.mjs";
import { Spinner } from 'cli-spinner';
import cliSpinners from 'cli-spinners';
import { exec, spawn } from 'child_process';
import readline from 'readline';


export async function loadCustomCommands(configFile) {

    const existingConfig = configFile && configFile.length && JSON.parse(await readFile(configFile, true).catch(async () => await readFile('git-config.json'))) || null;

    if (!existingConfig) {
        error('No config file found');
        return;
    }

    const commands = existingConfig?.custom?.commands || [];

    if (commands.length < 1) {
        error('No commands found');
        return;
    }


    if (!commands.every(c => Object.keys(c).length === 3)) {
        error('Invalid command config file');
        return;
    }


    return commands.map(c => ({ command: c.command, description: c.description, alias: c.alias }));

}


export async function addNewCommand(configFile) {

    const configAsString = configFile && (await readFile(configFile, true).catch(async () => await readFile('git-config.json'))) || null;

    if (!configAsString) {
        error('No config file is found')
        return;
    }

    let configJson = JSON.parse(configAsString);


    let newCommand = await ask({
        type: 'input',
        name: 'command',
        message: 'Enter the command to run',
    });

    let alias = await ask({
        type: 'input',
        name: 'alias',
        message: 'Enter the alias of the command',
    });

    let description = await ask({
        type: 'input',
        name: 'description',
        message: 'Enter the description of the command',
    });

    if (!newCommand.command || !alias.alias || !description.description) {
        error('Please provide valid arguments!');
        return;
    }

    const commands = configJson?.custom?.commands || [];
    commands.push({ command: newCommand.command, description: description.description, alias: alias.alias });
    configJson.custom = { commands: commands };

    await writeFile(configFile, JSON.stringify(configJson, null, 2), true);

    success('Command added successfully');
    console.table(commands);
}


export async function executeCommand(alias, configFile) {

    const existingConfig = configFile && configFile.length && JSON.parse(await readFile(configFile, true).catch(async () => await readFile('git-config.json'))) || null;

    if (!existingConfig) {
        error('No config file found');
        return;
    }

    const commands = existingConfig?.custom?.commands || [];

    const commandToExecute = commands.find(c => c?.alias?.trim() === alias.trim());
    if (!commandToExecute) {
        error('Command not found');
        return;
    }
    const spinner = new Spinner();
    const spinnerAnimations = [
        ...cliSpinners.arrow3.frames,
        ...cliSpinners.pong.frames,
    ];

    spinner.setSpinnerString(spinnerAnimations.join(''))
    spinner.start();

    info(`Executing command : ${commandToExecute.command}`);
    exec(commandToExecute.command, (err, stdout, stderr) => {
        if (err) {
            error(err);
            spinner.stop();
            return;
        }
        log(stdout);
        spinner.stop();
    });
}


export async function runApp(path_, app, type, configJson) {

    const path = composePath(path_, app);
    log(path)

    process.chdir(path)

    switch (type) {
        case 'spring-boot':

            const springBootCommand = configJson?.run?.backEnd?.command || 'mvn spring-boot:run';

            info(`Running Spring Boot app: ${app}`);

            return new Promise((resolve, reject) => {
                const child = spawn(springBootCommand, { shell: true, stdio: 'inherit' });

                child.on('error', (err) => {
                    error(err);
                    reject(app);
                });

                process.on('SIGINT', () => {
                    log(`Stopping ${app} process...`);
                    child.kill('SIGINT');
                    
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        error(`${app} process exited with code ${code}`);
                        reject(app);
                    }
                });
            });
        case 'react':

            const reactCommand = configJson?.run?.frontEnd?.command || 'npm run start';
            info(`Starting React App: ${app}`);
            return new Promise((resolve, reject) => {
                const child = spawn(reactCommand, { shell: true, stdio: 'inherit' });

                child.on('error', (err) => {
                    error(err);
                    reject(app);
                });

                process.on('SIGINT', () => {
                    log(`Stopping ${app} process...`);
                    child.kill('SIGINT');
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        error(`${app} process exited with code ${code}`);
                        reject(app);
                    }
                });
            });
        default:
            error('Invalid type');
            return null;
    }
}

export async function installDepsOno(path_, app, type, configJson) {

    const path = composePath(path_, app)
    log(path)

    process.chdir(path)

    switch (type) {
        case 'spring-boot':

            const springBootCommand = configJson?.install?.backEnd?.command || 'mvn clean install -DskipTests';

            info(`Installing dependencies for Spring Boot app: ${app}`);

            return new Promise((resolve, reject) => {
                const child = spawn(springBootCommand, { shell: true, stdio: 'inherit' });

                child.on('error', (err) => {
                    error(err);
                    reject(app);
                });

                process.on('SIGINT', () => {
                    log(`Stopping ${app} process...`);
                    child.kill('SIGINT');
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        error(`${app} process exited with code ${code}`);
                        reject(app);
                    }
                });
            });
        case 'react':

            const reactCommand = configJson?.install?.frontEnd?.command || 'npm install';
            info(`Installing dependencies for React App: ${app}`);
            return new Promise((resolve, reject) => {
                const child = spawn(reactCommand, { shell: true, stdio: 'inherit' });

                child.on('error', (err) => {
                    error(err);
                    reject(app);
                });

                process.on('SIGINT', () => {
                    log(`Stopping ${app} process...`);
                    child.kill('SIGINT');
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        resolve();
                    } else {
                        error(`${app} process exited with code ${code}`);
                        reject(app);
                    }
                });
            });

        default:
            error('Invalid type');
            return null;
    }
}


export async function resetCLI() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

   
    console.log('Press Enter to continue...');
    rl.question('', async () => {
        rl.close();

        await removeFolderRecursively(composePath(getHomeDir(), 'SetupWiz-cli', 'resources'));
        await removeFile(composePath(getResources(), '.$$'));
        await removeFile(composePath(getResources(), 'git-config.json'));
        info('💉THE CRIME SCENE IS CLEAN, BOSS!💉\n')
    });
}



