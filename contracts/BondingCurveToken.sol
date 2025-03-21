// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.28;

import "../interfaces/IBondingCurveToken.sol";

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "abdk-libraries-solidity/ABDKMath64x64.sol";

/// @title BondingCurveToken
/// @notice ERC20 Contract with a bondig curve pricing model (exponential)
/// @dev Inherited from ERC20, Ownable, ReentrancyGuard
contract BondingCurveToken is IBondingCurveToken, ERC20, Ownable, ReentrancyGuard {
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
    function buyTokens(uint256 amount) external payable override nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        require(msg.value > 0, "ETH sent must be greater than 0");

        uint256 initialSupply = totalSupply();
        uint256 finalSupply = initialSupply + amount;

        uint256 totalCost = calculateExponentialCost(initialSupply, finalSupply);
        
        require(msg.value >= totalCost, "Insufficient ETH sent");

        currentPrice = getPriceAtSupply(finalSupply); // Update global price
        _mint(msg.sender, amount);

        uint256 ethRefund = msg.value - totalCost;
        if (ethRefund > 0) {
            payable(msg.sender).transfer(ethRefund); // Refund
        }

        emit TokensBought(msg.sender, amount, totalCost);
    }

    /// @inheritdoc IBondingCurveToken
    function sellTokens(uint256 amount) external override nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Not enough tokens to sell");

        uint256 initialSupply = totalSupply();
        uint256 finalSupply = initialSupply - amount;

        uint256 refundAmount = calculateExponentialCost(finalSupply, initialSupply);
        
        require(address(this).balance >= refundAmount, "Not enough ETH in contract");

        _burn(msg.sender, amount);
        currentPrice = getPriceAtSupply(finalSupply); // Update global price

        payable(msg.sender).transfer(refundAmount); // Send ETH

        emit TokensSold(msg.sender, amount, refundAmount);
    }

    /// @inheritdoc IBondingCurveToken
    function withdraw(uint256 amount) external override onlyOwner nonReentrant {
        require(address(this).balance >= amount, "Not enough ETH");
        payable(owner()).transfer(amount);
    }

    /// @notice Calculates the total cost for minting or burning tokens using an exponential price formula with fixed-point math
    /// @param startSupply The supply before minting or burning (in token wei units)
    /// @param endSupply The supply after minting or burning (in token wei units)
    /// @return totalCost The total ETH cost in Wei
    function calculateExponentialCost(uint256 startSupply, uint256 endSupply) public pure returns (uint256 totalCost) {
        require(startSupply < endSupply, "Invalid supply range");
        // Convert token amounts to 64.64 fixed‑point by dividing by 1e18
        int128 startSupplyFixed = ABDKMath64x64.div(ABDKMath64x64.fromUInt(startSupply), ABDKMath64x64.fromUInt(1e18));
        int128 endSupplyFixed = ABDKMath64x64.div(ABDKMath64x64.fromUInt(endSupply), ABDKMath64x64.fromUInt(1e18));

        // Get the multiplier as fixed-point: FACTOR_NUM / FACTOR_DEN
        int128 factor = ABDKMath64x64.div(ABDKMath64x64.fromUInt(FACTOR_NUM), ABDKMath64x64.fromUInt(FACTOR_DEN));

        int128 startSupplyPowered = powFractional(factor, startSupplyFixed);
        int128 endSupplyPowered = powFractional(factor, endSupplyFixed);
        
        // Divider = factor - 1
        int128 divider = ABDKMath64x64.sub(factor, ABDKMath64x64.fromUInt(1));
        
        int128 diff = ABDKMath64x64.sub(endSupplyPowered, startSupplyPowered);

        // Divide the difference by (factor - 1)
        diff = ABDKMath64x64.div(diff, divider);
        // Multiply by BASE_PRICE and convert back to uint256
        totalCost = ABDKMath64x64.mulu(diff, BASE_PRICE);
    }

    /// @notice Returns the price of the next token at a given supply level using fixed‑point math
    /// @param supply The supply level (in token wei units)
    /// @return price The price of the next token in Wei
    function getPriceAtSupply(uint256 supply) public pure returns (uint256 price) {
        // Convert supply to fixed‑point value: (supply / 1e18)
        int128 supplyFixed = ABDKMath64x64.div(ABDKMath64x64.fromUInt(supply), ABDKMath64x64.fromUInt(1e18));
        int128 factor = ABDKMath64x64.div(ABDKMath64x64.fromUInt(FACTOR_NUM), ABDKMath64x64.fromUInt(FACTOR_DEN));
        int128 powered = powFractional(factor, supplyFixed);
        price = ABDKMath64x64.mulu(powered, BASE_PRICE);
    }

    function powFractional(int128 x, int128 y) internal pure returns (int128) {
        // x^y = exp_2(y * log_2(x))
        return ABDKMath64x64.exp_2(ABDKMath64x64.mul(ABDKMath64x64.log_2(x), y));
    }
}
