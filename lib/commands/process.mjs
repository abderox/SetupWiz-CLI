import { Spinner } from 'cli-spinner';
import cliSpinners from 'cli-spinners';
import { exec } from 'child_process';
import os from 'os';
import { error, log, success } from '../logger.mjs';

export function killProcessByPort(port) {

    if (!port) {
        error('Port number is required');
        return;
    }

    const spinner = new Spinner('Looking...  \n');
    const spinnerAnimations = [
        ...cliSpinners.arrow3.frames,
        ...cliSpinners.dots.frames,
        ...cliSpinners.triangle.frames,

    ];
    spinner.setSpinnerString(spinnerAnimations.join(''))
    spinner.start();

    const command = os.platform() === 'win32' ? `netstat -ano` : `lsof -i :${port} -t`;

    exec(command, (err, stdout, stderr) => {
        if (err) {
            error(err);
            spinner.stop();
            return;
        }


        const pids = stdout.split('\n')
            .map(line => line.trim())
            .filter(line => line.includes(`:${port}`))
            .map(line => line?.split(' ')?.filter(item => item))
            ?.map(items => items[items.length - 1]);

        if (pids.length && pids.length > 0) {
            console.table(pids)
        }
        else {
            error('No process found')
            return;
        }

        pids.forEach(pid => {
            const killCommand = os.platform() === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
            exec(killCommand, (err) => {
                if (err) {
                    error(err);


                } else {
                    success(`Killed process with PID ${pid}`);
                }
            });
        });


    });
    spinner.stop();
}


export function lookForProcessByPort(port) {

    if (!port) {
        error('Port number is required');
        return;
    }

    const spinner = new Spinner('Looking...  \n');
    const spinnerAnimations = [
        ...cliSpinners.arrow3.frames,
        ...cliSpinners.dots.frames,
        ...cliSpinners.triangle.frames,

    ];
    spinner.setSpinnerString(spinnerAnimations.join(''))
    spinner.start();
    const command = os.platform() === 'win32' ? `netstat -ano` : `lsof -i :${port} -t`;

    exec(command, (err, stdout, stderr) => {
        if (err) {
            error(err);
            spinner.stop();
            return;
        }

        const pids = stdout.split('\n')
            .map(line => line.trim())
            .filter(line => line.includes(`:${port}`))

        if (pids.length && pids.length > 0) {
            console.table(pids)
        }
        else {
            error('No process found')
        }
    })

    spinner.stop();
};