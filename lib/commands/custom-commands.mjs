import { ask } from '../inquirer.mjs';
import { error, info, log, success } from '../logger.mjs';
import {  readFile, writeFile } from "../../utils/io.mjs";
import { Spinner } from 'cli-spinner';
import cliSpinners from 'cli-spinners';
import { exec } from 'child_process';


export async function loadCustomCommands(configFile) {

    const existingConfig = configFile && configFile.length && JSON.parse(await readFile(configFile, true).catch(async()=>await readFile('git-config.json'))) || null;

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

    const configAsString = configFile && (await readFile(configFile, true).catch(async()=>await readFile('git-config.json'))) || null;

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

    await writeFile(configFile, JSON.stringify(configJson,null,2), true);

    success('Command added successfully');
    console.table(commands);
}


export async function executeCommand(alias, configFile) {

    const existingConfig = configFile && configFile.length && JSON.parse(await readFile(configFile, true).catch(async()=>await readFile('git-config.json'))) || null;

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







