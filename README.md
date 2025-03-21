# Bonding Curve Token Project

This project demonstrates an advanced Hardhat setup featuring a Bonding Curve Token with a dynamic pricing model (**Exponential Curve**) via Hardhat Ignition.

## Overview

- **BondingCurveToken Contract**  
  An ERC20 token that implements a bonding curve pricing mechanism. The token price increases exponentially as tokens are minted and decreases when tokens are sold. The contract includes functions to buy tokens using ETH, sell tokens back for ETH, and allow the owner to withdraw ETH from the contract.

## Features

- Dynamic token pricing using a bonding curve.
- Minting and selling of tokens with automatic price adjustments.
- Refund mechanism for excess ETH during token purchases.
- Comprehensive test suite using Hardhat and Viem.
- **MaxSupply Constraint**: Enforces an upper limit on the total number of tokens that can be minted.

## Bonding Curve Formula Explanation

A bonding curve is a mathematical relationship between token price and token supply. In this contract, the price of the token increases as more tokens are minted and decreases when tokens are burned (sold back).

- **Exponential Curve**: Here, each token purchase increases the price by a fixed percentage. I implemented this as `Price_n = Price_{n-1} * 1.01` (i.e., `1%` increase per token). This means if the current token price is `P`, the next token’s price will be `P * 1.01`. Over many tokens, this produces exponential growth in price. The initial price is again set to `0.01 ETH`, and with each token minted, `price = price * 1.01`. This curve grows even faster than the quadratic in the long run, ensuring that later tokens become very expensive, heavily rewarding early buyers​. (The factor `1.01` is an example; it could be configured differently for other exponential curves.)

## MaxSupply Explanation

The **MaxSupply** is a predefined cap on the total number of tokens that can ever be minted by the contract. This limit ensures scarcity and can help prevent uncontrolled token inflation. In this project, the MaxSupply is set to **1 billion** tokens. Once this cap is reached, the contract will no longer allow minting new tokens, protecting the token’s value by limiting the total supply.

## Installation

1. Clone the repository

   ```shell
   git clone https://github.com/magic990619/nacho-solidity-assessment.git
   cd nacho-solidity-assessment
   ```

2. Install dependencies
   ```shell
   npm install
   ```

## Available Scripts

- Compile Contracts
  ```shell
  npm run compile
  ```
- Run Tests
  ```shell
  npm run test
  ```
- Deploy Contracts & Verify

  ```shell
  npm run deploy
  ```

## Contract Deployed (Sepolia Network)

[BondingCurveToken - 0x208a107200EA433810e3A94bFaB6e8b3bE29ef26](https://sepolia.etherscan.io/address/0x208a107200EA433810e3A94bFaB6e8b3bE29ef26)

```
BASE_PRICE: 10000000000000000n (0.01 ETH)
FACTOR_NUM: 101
FACTOR_DEN: 100
currentPrice: 10000000000000000n
```

### Some Test Transactions

- Buy 1 Token
  [Tx](https://sepolia.etherscan.io/tx/0x704a4887d8e94a2ccea05d4b6e4667fbf138e3d7d0176b55185db21977474b13)

  ```
  currentPrice: 10099999999999999n
  totalSupply: 1000000000000000000n (1 BCT)
  ```

- Buy 2.5 Token again
  [Tx](https://sepolia.etherscan.io/tx/0x137c42836b419d4150372b851e2d1675cc99c58b6a8da4fecbace34d9fee124d)

  ```
  currentPrice: 10354396902316474n
  totalSupply: 3500000000000000000n (3.5 BCT)
  ```

- Sell 1.5 Token
  [Tx](https://sepolia.etherscan.io/tx/0x04672262b45b19ca50ee2e322e5f18966218aed9e430e740c2d73d39266ac763)
  ```
  currentPrice: 10200999999999999n
  totalSupply: 2000000000000000000n (2 BCT)
  ```

## Author

0xMagic - Drag

## License

UNLICENSED
