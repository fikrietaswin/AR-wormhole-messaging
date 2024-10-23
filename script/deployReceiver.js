// deploy.js
const { ethers } = require('ethers');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function main() {
    try {
        // Validate essential environment variables
        if (!process.env.PRIVATE_KEY) {
            throw new Error("PRIVATE_KEY is not set in the environment variables.");
        }

        // Load the chain configuration from the JSON file
        const chainsPath = path.resolve(__dirname, '../deploy-config/chains.json');
        const chainsData = await fs.readFile(chainsPath, 'utf8');
        const chains = JSON.parse(chainsData);

        // Get the Celo Testnet configuration
        const celoChain = chains.chains.find(chain => chain.description.includes('Celo Testnet'));
        if (!celoChain) {
            throw new Error("Celo Testnet configuration not found in chains.json.");
        }

        // Set up the provider and wallet
        const provider = new ethers.JsonRpcProvider(celoChain.rpc);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        // Load the ABI and bytecode of the MessageReceiver contract
        const messageReceiverPath = path.resolve(__dirname, '../out/MessageReceiver.sol/MessageReceiver.json');
        const messageReceiverData = await fs.readFile(messageReceiverPath, 'utf8');
        const messageReceiverJson = JSON.parse(messageReceiverData);

        const { abi, bytecode } = messageReceiverJson;

        // Create a ContractFactory for MessageReceiver
        const MessageReceiverFactory = new ethers.ContractFactory(abi, bytecode, wallet);

        console.log("Deploying MessageReceiver contract...");
        // Deploy the contract using the Wormhole Relayer address for Celo Testnet
        const receiverContract = await MessageReceiverFactory.deploy(celoChain.wormholeRelayer);
        await receiverContract.deployed();

        console.log('MessageReceiver deployed to:', receiverContract.address);

        // Update the deployedContracts.json file
        const deployedContractsPath = path.resolve(__dirname, '../deploy-config/deployedContracts.json');
        let deployedContracts = {};
        try {
            const deployedContractsData = await fs.readFile(deployedContractsPath, 'utf8');
            deployedContracts = JSON.parse(deployedContractsData);
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File does not exist, initialize an empty object
                deployedContracts = {};
            } else {
                throw err;
            }
        }

        // Retrieve the address of the MessageSender from the deployedContracts.json file
        const avalancheContracts = deployedContracts.avalanche;
        if (!avalancheContracts || !avalancheContracts.MessageSender) {
            throw new Error("Avalanche MessageSender address not found in deployedContracts.json.");
        }
        const avalancheSenderAddress = avalancheContracts.MessageSender;

        // Define the source chain ID for Avalanche Fuji
        const sourceChainId = 6;

        console.log("Registering Avalanche MessageSender address...");
        // Call setRegisteredSender on the MessageReceiver contract
        const tx = await receiverContract.setRegisteredSender(
            sourceChainId,
            ethers.zeroPadValue(avalancheSenderAddress, 32)
        );
        await tx.wait(); // Wait for the transaction to be confirmed

        console.log(`Registered MessageSender (${avalancheSenderAddress}) for Avalanche chain (${sourceChainId})`);

        // Update the deployedContracts.json with the new Celo deployment
        deployedContracts.celo = {
            MessageReceiver: receiverContract.address,
            deployedAt: new Date().toISOString(),
        };

        await fs.writeFile(deployedContractsPath, JSON.stringify(deployedContracts, null, 2));
        console.log("Deployment details updated in deployedContracts.json.");

        // Optional: Set up event listeners for game transactions
        // This can be extended based on specific requirements
        setupEventListeners(receiverContract);

    } catch (error) {
        console.error("Error during deployment:", error);
        process.exit(1);
    }
}

function setupEventListeners(contract) {
    // Listen for GameTransactionProcessed events
    contract.on("GameTransactionProcessed", (player, action, value, event) => {
        console.log(`Game Transaction - Player: ${player}, Action: ${action}, Value: ${value}`);
        // Additional logic can be added here, such as updating a database or triggering other processes
    });

    // Listen for MessageReceived events
    contract.on("MessageReceived", (message, event) => {
        console.log(`Message Received: ${message}`);
        // Additional processing can be done here
    });

    // Listen for SourceChainLogged events
    contract.on("SourceChainLogged", (sourceChain, event) => {
        console.log(`Source Chain Logged: ${sourceChain}`);
        // Additional processing can be done here
    });

    console.log("Event listeners set up for MessageReceiver contract.");
}

main();
