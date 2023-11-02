#! /usr/bin/env node
import { program } from 'commander';
import cloneCommand from '../lib/commands/clone.mjs';
import { getHomeDir, getResourcesOut, readFile } from '../utils/io.mjs';
import { custom, error, info, log, success } from '../lib/logger.mjs';
import { listGitRepositories, updateGitConfig } from '../lib/commands/git-config.mjs';
import { chooseACustomer, createNewEnvironment, openAProjectDirectory } from '../lib/commands/set-up-env.mjs';
import { addNewCommand, executeCommand, loadCustomCommands } from '../lib/commands/custom-commands.mjs';
import { init } from './init.mjs';


const version = "1.0.0";

const {
  gitVersion,
  nodeVersion,
  npmVersion,
  mvnVersion,
  logoBanner,
  colorBanner,
  cliDetails } = await init();

program.version(version);
program.description(custom(logoBanner,colorBanner));
program.description(success(cliDetails));
program.usage(
  '<command> option'
)


program
  .on('--help', () => {
    const commands = [
      {
        description: 'Show clone options',
        example: '$ swc clone --help',
      },
      {
        description: 'Clone a repository by title',
        example: '$ swc clone "some-repo-name"',
      },
      {
        description: 'Set Git username for The config file',
        example: '$ swc gc --username "Abdelhadi Mou"',
      },
      {
        description: 'Set Git repository URL for The config file',
        example: '$ swc gc --url bitbucket.org/company-project/',
      },
      {
        description: 'Setup a new configuration and much more',
        example: '$ swc setup',
      },
      {
        description: 'Setup a project environment for a specific customer',
        example: '$ swc setup -c "CUSTOMER-NAME"',
      },
      {
        description: 'Open a project directory for a specific customer',
        example: '$ swc setup -o "CUSTOMER-NAME"',
      },
      {
        description: 'List repositories for a specific project and the active branch in each',
        example: `$ swc gc -l '${getHomeDir()}'`,
      },
      {
        description: 'List all custom commands',
        example: '$ swc ct -l',
      },
      {
        description: 'Add a new custom command',
        example: '$ swc ct -a',
      },
      {
        description: 'Execute a custom command',
        example: '$ swc ct -e <command>',
      },
      {
        description: 'Show project license',
        example: '$ swc license',
      }
    ];

    log('');
    log(`PWD: ${process.cwd()}`);
    log('');
    log('Examples:');
    log('');
    commands.forEach((command) => {
      log(`  ${command.example.padEnd(50)} --->  ${command.description}`);
    });
    log('');
    log('Use swc <command> -h to see options');
    log('');
    log('Development tools versions:');
    log('');
    custom(`  -${gitVersion}`, 208);
    custom(`  -Node version: ${nodeVersion}`, 208);
    custom(`  -NPM version: ${npmVersion}`, 208);
    custom(`  -Maven version: ${mvnVersion}`, 208);
    log('');
    log('-----------------------------------------');
    log('!!! The config files are located here !!!');
    log(getResourcesOut());
    log('-----------------------------------------');
    log('');
    info('Developed by MOUZAFIR (c) 2023');
    log('');
  });


program.command('clone')
  .description('Clone a repository from Bitbucket')
  .action(() => {
    cloneCommand();
  });

program.command('setup')
  .description('Setup the environment for a specific customer project')
  .option('-c, --choose <customerName>', 'Like BCP, must be an existing customer!')
  .option('-o, --open <customer>','Open project directory, Like --open BCP, must be an existing customer!')
  .action((options) => {
    if (options.choose) {
      chooseACustomer(options.choose)
      return;
    }
    if(options.open) {
      openAProjectDirectory(options.open);
      return;
    }
    createNewEnvironment();
  });


program
  .command('gc')
  .description('Update the main Config file, and some other useful commands')
  .option('-u, --username <username>', 'Update Bitbucket username')
  .option('-r, --url "<url>"', 'Update Bitbucket URL, like : "bitbucket.org/company-project/"')
  .option('-l, --list "<path>"', 'Loop over the repositories and display the current branch for each.')
  .action((options) => {
    const username = options.username;
    const url = options.url;

    if (!options || options.length < 1) {
      error('Please provide a valid argument ! or use --help to see options');
      return;
    }

    if (username) {
      updateGitConfig(username, 'bitbucketUsername');
    }

    if (url) {
      updateGitConfig(url, 'bitbucketRepoUrl');
    }
    if (options.list) {
      info('Listing repositories along with the active branch :');
      log('---------------------');
      const repos = listGitRepositories(options.list);
      console.table(repos)
    }
  });

program.command('ct')
  .description('User custom commands')
  .option('-l, --list', 'List all custom commands')
  .option('-a, --add', 'Add a new custom command')
  .option('-e, --exec <argument>', 'Execute command using alias')
  .action(async (options) => {
    if (options.length < 1) {
      error('Please provide a valid argument ! or use --help to see options');
      return;
    }
    if (options.list) {
      info('Listing custom commands :');
      log('---------------------');
      const commands = await loadCustomCommands('git-config.json');
      console.table(commands);
    }
    if (options.add) {
      await addNewCommand('git-config.json');
    }
    if (options.exec) {
      await executeCommand(options.exec, 'git-config.json');
    }
  });

program.command('license')
  .description('Show project license')
  .action(async () => {
    const license = await readFile('LICENSE').catch(() => "https://github.com/abderox/SetupWiz-CLI/blob/master/LICENSE");
    log(license);
  })

program.parse(process.argv);
