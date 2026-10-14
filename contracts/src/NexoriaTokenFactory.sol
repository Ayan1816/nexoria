// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "./FixedSupplyToken.sol";

/// @title NexoriaTokenFactory
/// @notice Deploys a fixed-supply token and mints the entire supply to the caller.
/// @dev The contract holds no tokens, has no owner, and cannot mint into an existing token.
contract NexoriaTokenFactory {
    event TokenCreated(
        address indexed token,
        address indexed creator,
        string name,
        string symbol,
        uint256 wholeSupply
    );

    error NativeTransferRejected();

    function createToken(string calldata tokenName, string calldata tokenSymbol, uint256 wholeSupply)
        external
        returns (address token)
    {
        token = address(new FixedSupplyToken(tokenName, tokenSymbol, wholeSupply, msg.sender));
        emit TokenCreated(token, msg.sender, tokenName, tokenSymbol, wholeSupply);
    }

    receive() external payable {
        revert NativeTransferRejected();
    }

    fallback() external payable {
        revert NativeTransferRejected();
    }
}
