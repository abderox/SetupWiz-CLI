import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { error, info } from '../lib/logger.mjs';
import { exec } from 'child_process';
/**
 * Returns the home directory path.
 * @returns {string} The home directory path.
 */
export const getHomeDir = () => {
    return os.homedir();
}

/**
 * Returns the path of the directory containing the current module.
 * @returns {string} The path of the directory containing the current module.
 */
export const getPWD = () => {
    return path.dirname(fileURLToPath(import.meta.url));
}

/**
 * Returns the path of the resources directory.
 * @returns {string} The path of the resources directory.
 */
export const getResources = () => {
    return path.join(getPWD(), '../resources');
}

/**
 * Returns the path of the resources output directory.
 * If the directory does not exist, it will be created.
 * @returns {string} The path of the resources output directory.
 */
export const getResourcesOut = () => {
    const path_ = path.join(getHomeDir(), 'SetupWiz-cli', 'resources');
    if (!fs.existsSync(path_)) {
        ensureDirectoryExists(path_)
    }
    return path_;
}

/**
 * Reads a file at the specified path.
 * @param {string} path_ - The path of the file to read.
 * @param {boolean} [sourceOut=false] - Whether to read from the resources outside this directory.
 * @returns {Promise<string>} A promise that resolves with the contents of the file.
 */
export const readFile = async (path_, sourceOut = false) => {
    return new Promise((resolve, reject) => {
        path_ = sourceOut ? path.join(getResourcesOut(), path_) : path.join(getResources(), path_);
        fs.readFile(path_, 'utf8', (err, data) => {
            err ? reject(err) : resolve(data);
        });
    });
}

/**
 * Writes data to a file at the specified path.
 * @param {string} path_ - The path of the file to write to.
 * @param {string} data - The data to write to the file.
 * @param {boolean} [sourceOut=false] - Whether to write to the resources outside this directory.
 * @returns {Promise<string>} A promise that resolves with the path of the written file.
 */
export const writeFile = async (path_, data, sourceOut = false, verbose = true) => {
    return new Promise((resolve, reject) => {
        path_ = sourceOut ? path.join(getResourcesOut(), path_) : path.join(getResources(), path_);
        if (verbose) {
            info('Updating  :' + path_)
        }
        fs.writeFile(path_, data, (err) => {
            err ? reject(err) : resolve(path_);
        });
    });
}

/**
 * Checks if a file or directory exists at the specified path.
 * @param {string} path_ - The path to check.
 * @returns {Promise<boolean>} A promise that resolves with a boolean indicating whether the path exists.
 */
export const isPathExist = (path_) => {
    return new Promise((resolve, reject) => {
        fs.access(path_, fs.constants.F_OK, (err) => {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Creates a directory at the specified path.
 * @param {string} path_ - The path of the directory to create.
 * @returns {Promise<void>} A promise that resolves when the directory is created.
 */
export const mkdir = (path_) => {

    let directory = path_;

    if (directory === '.') {
        directory = process.cwd();
    }

    if (directory.startsWith('.') && directory.length > 1) {
        directory = directory.replace('./', '').replace('.\\','');
        directory = composePath(process.cwd(), directory);
    }
    return new Promise((resolve, reject) => {
        fs.mkdir(directory, (err) => {
            err ? reject(err) : resolve();
        });
    });
}

/**
 * Copies a file from the source directory to the target directory.
 * @param {string} target - The path of the target directory.
 * @param {string} [filename] - The name of the file to copy. If not specified, the basename of the source directory will be used.
 * @param {string} [source=getResources()] - The path of the source directory.
 * @returns {Promise<void>} A promise that resolves when the file is copied.
 */
export async function copyFile(target, filename, source = getResources()) {

    const targetExists = await isPathExist(target);
    if (!targetExists) {
        await mkdir(target);
    }

    const targetFile = filename ? path.join(target, filename) : path.join(target, path.basename(source));
    const exists = await isPathExist(targetFile);

    if (exists) {
        return;
    }

    const sourceFile = path.join(source, filename);

    const sourceExists = await isPathExist(targetFile);
    if (sourceExists) {
        return;
    }

    await fs.promises.copyFile(sourceFile, targetFile)

}

/**
 * Reads the names of all files in the specified directory.
 * @param {string} source - The path of the directory to read from.
 * @returns {Promise<string[]>} A promise that resolves with an array of file names.
 */
export async function readFileNamesFromSource(source) {
    try {
        const files = await fs.promises.readdir(source);
        return files.map(file => path.basename(file));
    } catch (e) {
        error("COULD NOT READ FILES FROM SOURCE")
    }
}

/**
 * Returns an array of file names in the specified directory that include the specified string.
 * @param {string} name - The string to search for in the file names.
 * @param {string} [source=getResourcesOut()] - The path of the directory to search in.
 * @returns {Promise<string[]>} A promise that resolves with an array of matching file names.
 */
export async function getFilesIncludes(name, source = getResourcesOut()) {
    try {
        const fileNames = await readFileNamesFromSource(source);
        return fileNames.filter(fileName => fileName.includes(name)) || [];
    } catch (e) {
        error("COULD NOT READ FILES FROM SOURCE")
    }
}

/**
 * Joins path segments into a single path.
 * @param {...string} paths - The path segments to join.
 * @returns {string} The joined path.
 */
export function composePath(...paths) {
    return path.join(...paths);
}

/**
 * Replaces all instances of a parameter with a given value in a text string.
 * @param {string} param - The parameter to replace.
 * @param {string} value - The value to replace the parameter with.
 * @param {string} text - The text string to search and replace in.
 * @returns {string} The updated text string with all instances of the parameter replaced with the given value.
 */
export function replacePramWith(param, value, text) {
    const regex = new RegExp(`\\$\\{\\{${param}\\}\\}`, 'g');
    return text.replace(regex, value);

}


/**
 * Creates a directory at the specified path if it does not already exist.
 * @param {string} directoryPath - The path of the directory to create.
 */
function ensureDirectoryExists(directoryPath) {
    fs.mkdir(directoryPath, { recursive: true }, (err) => {
        if (err) {
            error(`Error creating directory: ${err.message}`);
        }
    });
}



export async function removeFile(path_) {
    return new Promise(
        (resolve, reject) => {
            fs.unlink(path_, (err) => {
                if (err) {
                    error(`Error removing file: ${err.message}`);
                    reject(err)
                }
                resolve()
            });
        }

    )
}




export function duplicateFile(path_, newPath) {
    return new Promise(
        (resolve, reject) => {
            fs.copyFile(path_, newPath, (err) => {
                if (err) {
                    error(`Error copying file: ${err.message}`);
                    reject(err)
                }
                resolve()
            });
        }
    )
}



export function openDirectory(path = '.') {
    const platform = os.platform();

    let directory = path;

    if (directory === '.') {
        directory = process.cwd();
    }

    if (directory.startsWith('.') && directory.length > 1) {
        directory = directory.replace('./', '');
        directory = composePath(process.cwd(), directory);
    }


    switch (platform) {
        case 'darwin':
            exec(`open "${directory}"`);
            break;
        case 'win32':
            exec(`start explorer "${directory}"`);
            break;
        case 'linux':
            try {

                exec(`xdg-open "${directory}"`);
            } catch (er) {
                try {

                    exec(`nautilus "${directory}"`);
                } catch (er) {
                    try {

                        exec(`dolphin "${directory}"`);
                    } catch (e) {
                        error('Unable to open the directory in Linux.');
                    }
                }
            }
            break;
        default:
            error('Unsupported operating system.');
    }
}


