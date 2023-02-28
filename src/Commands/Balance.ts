import { ethers } from "ethers";

import { nodeCommand } from "./Command.js";
import Store from "./Store.js";
import Logger from "../Logger.js";
import { NoConfiguredNameError } from "../errors.js";

export default class Balance extends nodeCommand {
    constructor(network: string) {
        super(network);
    }

    showBalance = async (_address: string): Promise<void> => {
        Balance.startSpinner("fetching balance");

        try {
            let address = _address;

            if (!address.startsWith("0x")) {
                const tmp = await Store.retrieve("address", address);

                if (tmp) {
                    address = tmp;
                }
            }

            const balance = (
                await this.provider.getBalance(address)
            ).toString();

            Balance.stopSpinner();

            const data = {
                wei: balance,
                eth: ethers.formatEther(balance),
            };

            Logger.log("balance", data);
        } catch (error: any) {
            Balance.stopSpinner(false);

            if (error instanceof NoConfiguredNameError) {
                Logger.error(error, {
                    suggestion:
                        "can not resolve name to address. Try storing address first using store command",
                });
            } else if (ethers.isError(error, "UNCONFIGURED_NAME")) {
                Logger.error(error, {
                    suggestion:
                        "provided address does not seem correct. Try checking it",
                });
            } else {
                Logger.error(error);
            }
        }
    };
}
