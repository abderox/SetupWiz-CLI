#! /usr/bin/env node
import { program } from 'commander';
import cloneCommand from '../lib/commands/clone.mjs';
import { getHomeDir, getResourcesOut, readFile } from '../utils/io.mjs';
import { custom, error, info, log, success } from '../lib/logger.mjs';
import { importConfig, listGitRepositories, switchVCS, updateGitConfig } from '../lib/commands/git-config.mjs';
import { chooseACustomer, createNewEnvironment, openAProjectDirectory } from '../lib/commands/set-up-env.mjs';
import { addNewCommand, executeCommand, loadCustomCommands, resetCLI } from '../lib/commands/custom-commands.mjs';
import { init } from './init.mjs';
import { killProcessByPort, lookForProcessByPort } from '../lib/commands/process.mjs';


const version = "1.2.3";

const {
  gitVersion,
  nodeVersion,
  npmVersion,
  mvnVersion,
  logoBanner,
  colorBanner,
  cliDetails } = await init(version);

program.version(version);
program.description(custom(logoBanner, colorBanner));
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
        description: 'Clone a repository',
        example: '$ swc clone',
      },
      {
        description: 'Set Git username for The config file',
        example: '$ swc gc --username "AbdelhadiMou"',
      },
      {
        description: 'Set Bitbucket project URL for The config file',
        example: '$ swc gc --project "company-project"',
      },
      {
        description: 'Switch between Bitbucket and Github',
        example: '$ swc gc --vsc',
      },
      {
        description: 'List repositories for a specific project and the active branch in each',
        example: `$ swc gc -l "${getHomeDir()}"`,
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
        description: 'Import configuration file from source to CLI resources',
        example: '$ swc setup -i "homedir\\source\\file.json"',
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
        example: '$ swc ct -e <alias>',
      },
      {
        description: 'Show project license',
        example: '$ swc license',
      },
      {
        description: 'Kill processes by Port number',
        example: '$ swc p -k <port>',
      }, {
        description: 'Find Processes by Port number',
        example: '$ swc p -s <port>',
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
  .option('-o, --open <customer>', 'Open project directory, Like --open BCP, must be an existing customer!')
  .option('-i, --import "<path>"', "Import configuration file from source to CLI resources")
  .action((options) => {
    if (options.choose) {
      chooseACustomer(options.choose)
      return;
    }
    if (options.open) {
      openAProjectDirectory(options.open);
      return;
    }
    if (options.import) {
      importConfig(options.import)
      return;
    }
    createNewEnvironment();
  });


program
  .command('gc')
  .description('Update the main Config file, and some other useful commands')
  .option('-u, --username <username>', 'Update Bitbucket username')
  .option('-p, --project "<project>"', 'Update Bitbucket Project, like : "company-project"')
  .option('-v, --vsc', 'Switch between "bitbucket" and "github"')
  .option('-l, --list "<path>"', 'Loop over the repositories and display the current branch for each.')
  .action((options) => {
    const username = options.username;
    const project = options.project;

    if (!options || options.length < 1) {
      error('Please provide a valid argument ! or use --help to see options');
      return;
    }

    if (username) {
      updateGitConfig(username, 'username');
    }

    if (project) {
      updateGitConfig(project, 'bitbucketProject');
    }
    if (options.vsc) {
      switchVCS(options.vsc)
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
  .option('-e, --exec <alias>', 'Execute command using alias')
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

program.command('p')
  .description('Handle Processes')
  .option('-k, --port <port>', 'Kill processes by Port number')
  .option('-s, --search <port>', 'Find Processes by Port number')
  .action(async (options) => {
    if (options.length < 1) {
      error('Please provide a valid argument ! or use --help to see options');
      return;
    }
    if (options.port) {
      const port = options.port && typeof options.port !== 'number' && parseInt(options.port) || undefined;
      killProcessByPort(port);
    }

    if (options.search) {
      const search = options.search && typeof options.search !== 'number' && parseInt(options.search?.trim() || '-1') || undefined;
      lookForProcessByPort(search);
    }


  });


program.command('license')
  .description('Show project license')
  .action(async () => {
    const license = await readFile('LICENSE').catch(() => "https://github.com/abderox/SetupWiz-CLI/blob/master/LICENSE");
    log(license);
  })

  program.command('reset')
  .description('Reset CLI to default. It will remove all your added configurations')
  .action(async () => {
    await resetCLI();
  })


program.parse(process.argv);

