# Bonding Curve Token Project

This project demonstrates an advanced Hardhat setup featuring a **Exponential Bonding Curve Token** with a dynamic pricing model (**Exponential Curve**) via Hardhat Ignition.

## Overview

- **BondingCurveToken Contract**  
  An ERC20 token that implements a bonding curve pricing mechanism. The token price increases exponentially as tokens are minted and decreases when tokens are sold. The contract includes functions to buy tokens using ETH, sell tokens back for ETH, and allow the owner to withdraw ETH from the contract.

## Features

- Dynamic token pricing using a bonding curve.
- Minting and selling of tokens with automatic price adjustments.
- Refund mechanism for excess ETH during token purchases.
- Comprehensive test suite using Hardhat and Viem.
- **MaxSupply Constraint**: Enforces an upper limit on the total number of tokens that can be minted.

## Exponential Bonding Curve Formula Explanation

A bonding curve is a mathematical relationship between token price and token supply. In this contract, the price of the token increases as more tokens are minted and decreases when tokens are burned (sold back).

For an ERC20 token with 18 decimals, we define:

- **Base Price (\($P_0$\))**: The initial price for the first token (e.g., 0.01 ETH, represented as `1e16` Wei).
- **Growth Factor (\($f$\))**: A multiplier representing the percentage increase per token. It is defined as:

  $$
  f = \frac{\text{FACTOR\_NUM}}{\text{FACTOR\_DEN}}
  $$

  For example, if `FACTOR_NUM = 101` and `FACTOR_DEN = 100`, then \( $f = 1.01$ \) (a 1% increase per token).

- **Current Supply (\($S$\))**: The number of tokens already minted (measured in whole tokens).

### Price of the Next Token

The price for the next token when the current supply is \( $S$ \) is given by:

$$
P_S = P_0 \times f^S
$$

This means:

- At supply \( $S=0$ \): \( $P_0$ \)
- At supply \( $S=1$ \): \( $P_0 \times 1.01$ \)
- At supply \( $S=2$ \): \( $P_0 \times 1.01^2$ \)
- and so on.

### Total Cost to Mint Tokens

If you want to mint tokens such that the supply goes from \( $S_0$ \) to \( $S_1$ \) (i.e., you mint \( $T = S_1 - S_0$ \) tokens), the total cost is the sum of the prices for each token in that range:

$$
\text{Total Cost} = \sum_{i=S_0}^{S_1 - 1} \left( P_0 \times f^i \right)
$$

Since this is a geometric series, it can be expressed in closed form:

$$
\text{Total Cost} = P_0 \times \frac{f^{S_1} - f^{S_0}}{f - 1}
$$

#### Example

Assume:

- \( $P_0 = 0.01$ \) ETH
- \( $f = 1.01$ \)

To mint the first token (from \( $S_0 = 0$ \) to \( $S_1 = 1$ \)):

$$
\text{Cost} = 0.01 \times \frac{1.01^1 - 1.01^0}{1.01 - 1} = 0.01 \times \frac{1.01 - 1}{0.01} = 0.01 \text{ ETH}
$$

To mint two tokens (from \( $S_0 = 0$ \) to \( $S_1 = 2$ \)):

$$
\text{Cost} = 0.01 \times \frac{1.01^2 - 1}{0.01} = 0.01 \times \frac{1.0201 - 1}{0.01} = 0.01 \times 2.01 = 0.0201 \text{ ETH}
$$

Here, the cost is the sum of:

- One token: 0.01 ETH
- Two tokens: approximately 0.0101 ETH

### Handling 18 Decimal Tokens

All values (prices, supplies, and costs) are scaled by \( $10^{18}$ \) to match the 18 decimal places of the ERC20 standard. The contract uses fixed‑point arithmetic to maintain this precision.

[ABDK Libraries for Solidity](https://www.npmjs.com/package/abdk-libraries-solidity) (Used this library in the contract for fixed-point mathematical functions)

---

This model ensures that the token price increases exponentially with the supply, rewarding early buyers and creating a clear, deterministic pricing mechanism for token minting and burning.

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
