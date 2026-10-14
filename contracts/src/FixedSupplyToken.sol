// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title FixedSupplyToken
/// @notice ERC-20 with a single mint in the constructor. There is no owner and no later mint.
/// @dev Approve cannot move a non-zero allowance to another non-zero value. Set it to zero first.
contract FixedSupplyToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public immutable totalSupply;

    uint256 public constant MAX_WHOLE_SUPPLY = 1_000_000_000_000_000;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    error ZeroAddress();
    error ZeroSupply();
    error SupplyTooLarge();
    error InvalidMetadata();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ApproveFromNonZero();
    error NativeTransferRejected();

    constructor(string memory tokenName, string memory tokenSymbol, uint256 wholeSupply, address recipient) {
        if (recipient == address(0)) revert ZeroAddress();
        if (!_validName(tokenName) || !_validSymbol(tokenSymbol)) revert InvalidMetadata();
        if (wholeSupply == 0) revert ZeroSupply();
        if (wholeSupply > MAX_WHOLE_SUPPLY) revert SupplyTooLarge();

        name = tokenName;
        symbol = tokenSymbol;
        uint256 supply = wholeSupply * (10 ** uint256(decimals));
        totalSupply = supply;
        balanceOf[recipient] = supply;
        emit Transfer(address(0), recipient, supply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ZeroAddress();
        uint256 current = allowance[msg.sender][spender];
        if (current != 0 && amount != 0) revert ApproveFromNonZero();
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            unchecked {
                allowance[from][msg.sender] = allowed - amount;
            }
            emit Approval(from, msg.sender, allowance[from][msg.sender]);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = balanceOf[from];
        if (bal < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _validName(string memory value) internal pure returns (bool) {
        bytes memory data = bytes(value);
        uint256 length = data.length;
        if (length == 0 || length > 32) return false;
        if (data[0] == 0x20 || data[length - 1] == 0x20) return false;
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = data[i];
            if (char < 0x20 || char > 0x7E) return false;
        }
        return true;
    }

    function _validSymbol(string memory value) internal pure returns (bool) {
        bytes memory data = bytes(value);
        uint256 length = data.length;
        if (length < 2 || length > 8) return false;
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = data[i];
            bool digit = char >= 0x30 && char <= 0x39;
            bool upper = char >= 0x41 && char <= 0x5A;
            if (!digit && !upper) return false;
        }
        return true;
    }

    receive() external payable {
        revert NativeTransferRejected();
    }

    fallback() external payable {
        revert NativeTransferRejected();
    }
}
