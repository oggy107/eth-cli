import path from "path";
import solc from "solc";
import fs from "fs";

import { localCommand } from "./Command.js";

import { readContent, writeContent } from "../utils.js";
import { compiledOutput } from "../types.js";
import Logger from "../Logger.js";
import { CompilationError, DependencyPresentError } from "../errors.js";

export default class Compile extends localCommand {
    private static createOrClearDirectory = async (
        dirName: string
    ): Promise<void> => {
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName);
        } else {
            const files = await fs.promises.readdir(dirName);

            for (const file of files) {
                fs.unlink(path.join(dirName, file), (err) => {
                    if (err) throw err;
                });
            }
        }
    };

    private static isDependencyPresent = (src: string): boolean => {
        if (src.match("import")) return true;

        return false;
    };

    static compile = async (srcPath: string) => {
        this.startSpinner("compiling solidity");

        let gasEstimates = {};
        const outDirName = "compiled";

        try {
            await this.createOrClearDirectory(outDirName);
            const srcFileName = path.parse(srcPath).base;
            const srcFileContent = await readContent(srcPath);

            if (this.isDependencyPresent(srcFileContent)) {
                throw new DependencyPresentError();
            }

            const input = {
                language: "Solidity",
                sources: {
                    [srcFileName]: {
                        content: srcFileContent,
                    },
                },
                settings: {
                    outputSelection: {
                        "*": {
                            "*": ["*"],
                        },
                    },
                },
            };

            const output: compiledOutput = JSON.parse(
                solc.compile(JSON.stringify(input))
            );

            if (output.errors) {
                throw new CompilationError(output.errors);
            }

            for (let srcName in output.contracts) {
                for (let contractName in output.contracts[srcName]) {
                    const data = output.contracts[srcName][contractName];
                    const bytecode = data.evm.bytecode.object;
                    const abi = data.abi;
                    gasEstimates = data.evm.gasEstimates;

                    writeContent(
                        path.join(outDirName, contractName + ".obj"),
                        bytecode
                    );
                    writeContent(
                        path.join(outDirName, contractName + ".abi"),
                        JSON.stringify(abi)
                    );
                }
            }

            this.stopSpinner();

            Logger.log("gas estimations", gasEstimates);
        } catch (error: any) {
            this.stopSpinner(false);

            if (error instanceof DependencyPresentError) {
                Logger.error(error, {
                    suggestion:
                        "Try compiling solidity source code with no import statements or dependencies",
                });
            } else if (error instanceof CompilationError) {
                Logger.error(error, {
                    displayWhole: true,
                    suggestion:
                        "Try checking for syntax and other errors in passed solidity source code",
                });
            } else if (error.code == "ENOENT") {
                Logger.error(error, {
                    suggestion: "Try checking path of passed sourcecode",
                });
            } else {
                Logger.error(error, {
                    displayWhole: true,
                });
            }
        }
    };
}
