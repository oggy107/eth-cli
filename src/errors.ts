export class NoConfiguredNameError extends Error {
    constructor() {
        super("No configured names for address found");
        this.name = "NoConfiguredNameError";
    }
}

export class DependencyPresentError extends Error {
    constructor() {
        super(
            "Dependencies in solidity source code detected. Currently only compilation of solidity files without dependencies(without import statements) is supported"
        );
        this.name = "DependencyPresentError";
    }
}

export class CompilationError extends Error {
    data: Array<{}>;

    constructor(errorArray: Array<{}>) {
        super("Compilation Error");
        this.name = "compilationError";
        this.data = errorArray;
    }
}

export class NoRegisterdKeyFound extends Error {
    constructor() {
        super("No key was found corresponsing to given key name");
        this.name = "NoRegsiterdKeyFound";
    }
}
