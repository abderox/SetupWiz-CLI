import chalk from 'chalk';

const {red,blue,green} = chalk;

function info(message) {
  console.log(blue(message));
}

function success(message) {
  console.log(green(message));
}

function error(message) {
  console.log(red(message));
}

function logo(message) {
  console.log(chalk.ansi256(208)(message));
}

function custom(message, ansi256) {
  if (typeof ansi256 !== "number"){
    throw new Error("ansi256 must be a number");
  }
  console.log(chalk.ansi256(ansi256)(message));
}

function log(message) {
  console.log(message);
}

export  {
  info,
  success,
  error,
  logo,
  log,
  custom
};
