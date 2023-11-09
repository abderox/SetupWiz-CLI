import { ask } from '../inquirer.mjs';
import { custom, error, info } from '../logger.mjs';
import { composePath, getHomeDir, isPathExist, mkdir, readFile } from "../../utils/io.mjs";
import { exec } from 'child_process';
import { Spinner } from 'cli-spinner';
import cliSpinners from 'cli-spinners';
import { updateGitConfig } from './git-config.mjs';



async function cloneCommand() {

  const configString = await readFile('git-config.json', true).catch(async () => await readFile('git-config.json'));
  const config = configString && JSON.parse(configString);
  ask([
    {
      type: 'input',
      name: 'repository',
      message: 'Enter the repository name',
    },
    {
      type: 'input',
      name: 'destinationDirectory',
      message: 'Enter the destination directory',
      default: `${getHomeDir()}`,
    }
  ])
    .then(async (answers) => {

      if (!answers.repository) {
        error('Repository name is required');
        return;
      }

      await createDirectoryIfNotExist(answers);

      const gitCloneUrl = gitConfigUrl(config, answers.repository);
      await updateGitConfig(answers.destinationDirectory, 'path');
      const result = await gitClone(gitCloneUrl, answers.destinationDirectory);
      // success(result);
    }).catch(e => error(e)).finally(
      () => {
        info('Exited');
      }
    )
}

export function gitClone(gitCloneUrl, destinationDirectory_ = '.') {


  let destinationDirectory = destinationDirectory_;

  if (destinationDirectory === '.') {
    destinationDirectory = process.cwd();
  }

  if (destinationDirectory.startsWith('.') && destinationDirectory.length > 1) {
    destinationDirectory = destinationDirectory.replace('./', '');
    destinationDirectory = composePath(process.cwd(), destinationDirectory);
  }


  info(`Cloning repository : ${gitCloneUrl}`);
  custom(`to ${destinationDirectory}`, 207)

  return new Promise((resolve, reject) => {

    process.chdir(destinationDirectory);

    const spinner = new Spinner('Cloning...  ');
    const spinnerAnimations = [
      ...cliSpinners.arrow3.frames,
      ...cliSpinners.dots.frames,
      ...cliSpinners.circleHalves.frames,
      ...cliSpinners.triangle.frames,
      ...cliSpinners.pipe.frames,
      ...cliSpinners.dots8Bit.frames,
      ...cliSpinners.pong.frames,
    ];
    spinner.setSpinnerString(spinnerAnimations.join(''))
    spinner.start();

    const childProcess = exec(`git clone --verbose ${gitCloneUrl}`);

    childProcess.stdout.on('data', (data) => {
      process.stdout.write(data);
    });

    childProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    childProcess.on('close', (code) => {
      spinner.stop(true);
      if (code === 0) {
        resolve('Git clone completed successfully.');
      } else {
        reject(`Git clone failed with exit code ${code}`);
      }
    });
  });
}

async function createDirectoryIfNotExist(answers) {

  let directory = answers.destinationDirectory;

  if (directory === '.') {
    directory = process.cwd();
  }

  if (directory.startsWith('.') && directory.length > 1) {
    directory = directory.replace('./', '');
    directory = composePath(process.cwd(), directory);
  }

  let dirExists = await isPathExist(directory);

  if (!dirExists) {
    const response = await ask([
      {
        type: 'list',
        name: 'createDirectory',
        message: 'Destination directory does not exist. Do you want to create it?',
        choices: ['Yes', 'No'],
      }
    ]);

    if (response.createDirectory === 'Yes') {
      await mkdir(directory);
    }
  }
}


export function gitConfigUrl(config, repository) {

  switch (config?.gitVCS) {
    case "bitbucket":
      return bitbucketUrl(config, repository);
    case "github":
      return githubUrl(config, repository);
    default:
      return bitbucketUrl(config, repository);
  }


}

function bitbucketUrl(config, repository) {
  const bitbucketUsername = config.username || '<undefined>';
  const bitbucketProject = config.bitbucketProject || '<undefined>';
  return `https://${bitbucketUsername}@bitbucket.org/${bitbucketProject}/${repository}.git`;
}

function githubUrl(config, repository) {
  const githubUsername = config.username || '<undefined>';
  return `https://github.com/${githubUsername}/${repository}.git`;
}


export default cloneCommand;
