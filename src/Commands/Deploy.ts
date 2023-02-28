import { ethers, isError } from "ethers";

import { nodeCommand } from "./Command.js";
import { readContent } from "../utils.js";
import Logger from "../Logger.js";

export default class Deploy extends nodeCommand {
    constructor(network: string) {
        super(network);
    }

    deploy = async (
        bytecodePath: string,
        abiPath: string,
        privateKey: string
    ): Promise<void> => {
        Deploy.startSpinner("deploying contract");

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

            Deploy.stopSpinner();
            Deploy.startSpinner("waiting for block confirmation");

            const transactionReceipt = await contract
                .deploymentTransaction()
                ?.wait(1);
            contract.deploymentTransaction();
            const transactionResponse = contract.deploymentTransaction();

            const contractData = {
                ...transactionReceipt,
                ...transactionResponse,
            };

            Deploy.stopSpinner();

            Logger.log("contract", contractData);
        } catch (error: any) {
            Deploy.stopSpinner(false);

            if (isError(error, "INVALID_ARGUMENT")) {
                Logger.error(error, {
                    suggestion: "Try checking value of private key",
                });
            } else if (error.code == "ENOENT") {
                Logger.error(error, {
                    suggestion: "Try checking path of passed abi or bytecode",
                });
            } else {
                Logger.error(error);
            }
        }
    };
}
