// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.28;

import "../interfaces/IBondingCurveToken.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title BondingCurveToken
/// @notice ERC20 Contract with a bondig curve pricing model (exponential)
/// @dev Inherited from ERC20, Ownable
contract BondingCurveToken is IBondingCurveToken, ERC20, Ownable {
    // Constants
    uint256 public constant BASE_PRICE = 1e16; // Initial Price: 0.01 ETH
    uint256 public constant FACTOR_NUM = 101; // Price multiplier: 1.01 = 101 / 100
    uint256 public constant FACTOR_DEN = 100;
    uint256 public constant MAX_SUPPLY = 1000000000 * 10 ** 18; // 1B tokens

    uint256 public currentPrice;

    constructor() ERC20("Bonding Curve Token", "BCT") Ownable(msg.sender) {
        currentPrice = BASE_PRICE;
    }

    /// @inheritdoc IBondingCurveToken
    function buyTokens(uint256 amount) external payable override {
        require(amount > 0, "Amount must be greater than 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        require(msg.value > 0, "ETH sent must be greater than 0");

        uint256 cost = 0;
        uint256 price = currentPrice;
        for (uint256 i = 0; i < amount; i++) {
            cost += price;
            price = (price * FACTOR_NUM) / FACTOR_DEN;
        }

        require(msg.value >= cost, "Insufficient ETH sent");

        currentPrice = price; // Update global price
        _mint(msg.sender, amount);

        uint256 ethRefund = msg.value - cost;
        if (ethRefund > 0) {
            payable(msg.sender).transfer(ethRefund); // Refund
        }

        emit TokensBought(msg.sender, amount, cost);
    }

    /// @inheritdoc IBondingCurveToken
    function sellTokens(uint256 amount) external override {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Not enough tokens to sell");

        uint256 price = currentPrice;
        uint256 cost = 0;
        for (uint256 i = 0; i < amount; i++) {
            cost += price;
            price = (price * FACTOR_DEN) / FACTOR_NUM;
        }

        require(address(this).balance >= cost, "Not enough ETH in contract");

        _burn(msg.sender, amount);
        currentPrice = price; // Update global price

        payable(msg.sender).transfer(cost); // Send ETH

        emit TokensSold(msg.sender, amount, cost);
    }

    /// @inheritdoc IBondingCurveToken
    function withdraw(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough ETH");
        payable(owner()).transfer(amount);
    }
}
