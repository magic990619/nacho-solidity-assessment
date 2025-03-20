// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BondingCurveToken Interface
/// @notice Interface for BondingCurveToken contract
interface IBondingCurveToken is IERC20 {
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when buy tokens
    event TokensBought(address indexed buyer, uint256 amount, uint256 cost);
    /// @notice Emitted when sell tokens
    event TokensSold(address indexed seller, uint256 amount, uint256 cost);

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Buy tokens with ETH
    /// @param amount The amount of tokens to buy
    /// @dev The amount of ETH sent must be greater than 0, and refund exceed ETC
    function buyTokens(uint256 amount) external payable;

    /// @notice Sell tokens back for ETH
    /// @param amount The amount of tokens to sell
    /// @dev The amount of tokens to sell must be greater than 0
    function sellTokens(uint256 amount) external;

    /// @notice Withdraw ETH from the contract to owner
    /// @param amount The amount of ETH to withdraw
    /// @dev Only the owner can call this function
    function withdraw(uint256 amount) external;
}
