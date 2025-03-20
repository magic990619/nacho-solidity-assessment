// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.28;

import "../interfaces/IBondingCurveToken.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BondingCurveToken is ERC20, Ownable {
    // Constants
    uint256 public constant BASE_PRICE = 1e16; // Initial Price: 0.01 ETH
    uint256 public constant FACTOR_NUM = 101; // Price multiplier: 1.01 = 101 / 100
    uint256 public constant FACTOR_DEN = 100;
    uint256 public constant MAX_SUPPLY = 1000000000 * 10 ** 18; // 1B tokens

    uint256 public currentPrice;

    constructor() ERC20("Bonding Curve Token", "BCT") Ownable(msg.sender) {
        currentPrice = BASE_PRICE;
    }
}
