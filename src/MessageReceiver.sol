// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "lib/wormhole-solidity-sdk/src/interfaces/IWormholeRelayer.sol";
import "lib/wormhole-solidity-sdk/src/interfaces/IWormholeReceiver.sol";

contract MessageReceiver is IWormholeReceiver {
    IWormholeRelayer public immutable wormholeRelayer;
    address public immutable registrationOwner;

    // Mapping to store registered senders for each chain
    mapping(uint16 => bytes32) public registeredSenders;

    // Events
    event MessageReceived(string message);
    event SourceChainLogged(uint16 sourceChain);
    event GameTransactionProcessed(address indexed player, string action, uint256 value);

    // Custom Errors
    error NotRegisteredSender();
    error Unauthorized();

    constructor(address _wormholeRelayer) {
        if (_wormholeRelayer == address(0)) revert Unauthorized();
        wormholeRelayer = IWormholeRelayer(_wormholeRelayer);
        registrationOwner = msg.sender; // Set contract deployer as the owner
    }

    // Modifier to check if the sender is registered for the source chain
    modifier isRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) {
        if (registeredSenders[sourceChain] != sourceAddress) revert NotRegisteredSender();
        _;
    }

    // Function to register the valid sender address for a specific chain
    function setRegisteredSender(uint16 sourceChain, bytes32 sourceAddress) external {
        if (msg.sender != registrationOwner) revert Unauthorized();
        registeredSenders[sourceChain] = sourceAddress;
    }

    // Update receiveWormholeMessages to include the source address check
    function receiveWormholeMessages(
        bytes calldata payload,
        bytes[] calldata, // additional VAAs (optional, not needed here)
        bytes32 sourceAddress,
        uint16 sourceChain,
        bytes32 // delivery hash
    )
        external
        payable
        override
        isRegisteredSender(sourceChain, sourceAddress)
    {
        if (msg.sender != address(wormholeRelayer)) revert Unauthorized();

        // Decode the payload to extract the message and game transaction
        (
            string memory message,
            string memory action,
            address player,
            uint256 value
        ) = abi.decode(payload, (string, string, address, uint256));

        // Example use of sourceChain for logging
        if (sourceChain != 0) {
            emit SourceChainLogged(sourceChain);
        }

        // Emit an event with the received message
        emit MessageReceived(message);

        // Handle the game transaction
        handleGameTransaction(player, action, value);
    }

    // Internal function to handle game transactions
    function handleGameTransaction(address player, string memory action, uint256 value) internal {
        // Example logic: Update player score or perform actions based on 'action'
        // This is a placeholder; actual implementation depends on game requirements

        // Emit an event for the game transaction
        emit GameTransactionProcessed(player, action, value);

        // Additional game logic can be implemented here
    }
}
