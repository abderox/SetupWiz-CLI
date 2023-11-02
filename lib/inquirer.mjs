import inquirer from 'inquirer';

async function ask(promptQuestions) {
  return inquirer.prompt(promptQuestions);
}

export  {
  ask,
};
