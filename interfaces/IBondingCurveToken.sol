// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title BondingCurveToken Interface
/// @notice Interface for BondingCurveToken contract
interface IBondingCurveToken is IERC20 {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

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
}
