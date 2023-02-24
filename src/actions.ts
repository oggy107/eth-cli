import { JsonRpcProvider, ethers } from "ethers";
import ora, { Ora } from "ora";
import logSymbols from "log-symbols";
import path from "path";
import solc from "solc";
import prettyjson from "prettyjson";

import config from "./config.js";
import {
    readContent,
    writeContent,
    createOrClearDirectory,
    isDependencyPresent,
} from "./utils.js";
import { compiledOutput } from "./types.js";

export default class Action {
    private provider: JsonRpcProvider;
    private spinner: Ora;

    constructor(network: string) {
        if (network == config.networks.goerli.name) {
            this.provider = new ethers.JsonRpcProvider(
                config.networks.goerli.rpc_url
            );
        } else {
            this.provider = new ethers.JsonRpcProvider(
                config.networks.mainnet.rpc_url
            );
        }

        this.spinner = ora({ spinner: "dots5" });
    }

    private startSpinner = (name: string): void => {
        this.spinner.text = name;
        this.spinner.start();
    };

    private stopSpinner = (symbol: string): void => {
        this.spinner.stopAndPersist({
            symbol,
        });
    };

    showBalance = async (address: string): Promise<void> => {
        this.startSpinner("fetching balance");

        try {
            const balance = (
                await this.provider.getBalance(address)
            ).toString();

            this.stopSpinner(logSymbols.success);

            console.log(`wei: ${balance}\neth: ${ethers.formatEther(balance)}`);
        } catch (error: any) {
            this.stopSpinner(logSymbols.error);

            console.error(error.name, error.message);
        }
    };

    showBlock = async (blockNumber: number): Promise<void> => {
        this.startSpinner("fetching block");

        try {
            const block = await this.provider.getBlock(blockNumber);

            this.stopSpinner(logSymbols.success);

            console.log(
                `block:\n${prettyjson.renderString(JSON.stringify(block))}`
            );
        } catch (error: any) {
            this.stopSpinner(logSymbols.error);

            console.error(error.name, error.message);
        }
    };

    showBlockNumber = async (): Promise<void> => {
        this.startSpinner("fetching block number");

        try {
            const block = (await this.provider.getBlockNumber()).toString();

            this.stopSpinner(logSymbols.success);

            console.log(`Block Number : ${block}`);
        } catch (error: any) {
            this.stopSpinner(logSymbols.error);

            console.error(error.name, error.message);
        }
    };

    showTransaction = async (hash: string): Promise<void> => {
        this.startSpinner("fetching transaction");

        try {
            const tx = await this.provider.getTransaction(hash);

            this.stopSpinner(logSymbols.success);

            console.log(
                `transaction:\n${prettyjson.renderString(JSON.stringify(tx))}`
            );
        } catch (error: any) {
            this.stopSpinner(logSymbols.error);

            console.error(error.name, error.message);
        }
    };

    compile = async (srcPath: string) => {
        this.startSpinner("compiling solidity");

        let gasEstimates = null;
        const outDirName = "compiled";

        try {
            await createOrClearDirectory(outDirName);
            const srcFileName = path.parse(srcPath).base;
            const srcFileContent = await readContent(srcPath);

            if (isDependencyPresent(srcFileContent)) {
                throw new Error(
                    "currently only compilation of solidity files without dependencies(without import statements) is supported"
                );
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

            for (let srcName in output.contracts) {
                for (let contractName in output.contracts[srcName]) {
                    const data = output.contracts[srcName][contractName];
                    const bytecode = data.evm.bytecode.object;
                    const abi = data.abi;
                    gasEstimates = data.evm.gasEstimates;

                    writeContent(
                        path.join(outDirName, srcName + ".obj"),
                        bytecode
                    );
                    writeContent(
                        path.join(outDirName, srcName + ".abi"),
                        JSON.stringify(abi)
                    );
                }
            }

            this.stopSpinner(logSymbols.success);

            console.log(
                `gas estimations:\n${prettyjson.renderString(
                    JSON.stringify(gasEstimates)
                )}`
            );
        } catch (error: any) {
            this.stopSpinner(logSymbols.error);
            console.error(error.name, error.message);
            process.exit(1);
        }
    };

    deploy = async (
        bytecodePath: string,
        abiPath: string,
        privateKey: string
    ): Promise<void> => {
        this.startSpinner("deploying contract");

        try {
            const bytecode = await readContent(bytecodePath);
            const abi = await readContent(abiPath);

            const wallet = new ethers.Wallet(privateKey, this.provider);
            const contractFactory = new ethers.ContractFactory(
                abi,
                bytecode,
                wallet
            );

            const contract = await contractFactory.deploy();

            this.stopSpinner(logSymbols.success);
            this.startSpinner("waiting for block confirmation");

            const transactionReceipt = await contract
                .deploymentTransaction()
                ?.wait(1);
            contract.deploymentTransaction();
            const transactionResponse = contract.deploymentTransaction();

            const contractData = {
                ...transactionReceipt,
                ...transactionResponse,
            };

            this.stopSpinner(logSymbols.success);

            console.log(
                `contract:\n${prettyjson.renderString(
                    JSON.stringify(contractData, (key, value) => {
                        return typeof value === "bigint"
                            ? value.toString()
                            : value;
                    })
                )}`
            );
        } catch (error: any) {
            this.stopSpinner(logSymbols.error);

            console.error(error.name, error.message);
        }
    };
}
