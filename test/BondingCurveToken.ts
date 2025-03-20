import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

describe("BondingCurveToken", function () {
  async function deployBondingCurveTokenFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();
    const [ownerAddress] = await owner.getAddresses();
    const bondingToken = await hre.viem.deployContract("BondingCurveToken", []);
    const publicClient = await hre.viem.getPublicClient();

    // Read deployed contract constants.
    const BASE_PRICE = await bondingToken.read.BASE_PRICE();
    const FACTOR_NUM = await bondingToken.read.FACTOR_NUM();
    const FACTOR_DEN = await bondingToken.read.FACTOR_DEN();

    return { bondingToken, owner, ownerAddress, otherAccount, publicClient, BASE_PRICE, FACTOR_NUM, FACTOR_DEN };
  }

  describe("Deployment", function () {
    it("Should initialize with the correct base price", async function () {
      const { bondingToken, BASE_PRICE } = await loadFixture(deployBondingCurveTokenFixture);
      const currentPrice = await bondingToken.read.currentPrice();
      expect(currentPrice).to.equal(BASE_PRICE);
    });
  });

  describe("Buying Tokens", function () {
    it("Should allow buying tokens with exact ETH", async function () {
      const { bondingToken, ownerAddress, BASE_PRICE, FACTOR_NUM, FACTOR_DEN } = await loadFixture(deployBondingCurveTokenFixture);
      const amountToBuy = 1n; // buying 1 token
      // For 1 token, cost equals BASE_PRICE.
      const cost = BASE_PRICE;
      await bondingToken.write.buyTokens([amountToBuy], { value: cost });

      // Verify event emission.
      const events = await bondingToken.getEvents.TokensBought();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.buyer).to.equal(ownerAddress);
      expect(events[0].args.amount).to.equal(amountToBuy);
      expect(events[0].args.cost).to.equal(cost);

      // Verify the token was minted.
      const balance = await bondingToken.read.balanceOf([ownerAddress]);
      expect(balance).to.equal(amountToBuy);

      // Verify the new current price is updated using the formula: newPrice = (BASE_PRICE * FACTOR_NUM) / FACTOR_DEN.
      const expectedPrice = (BASE_PRICE * FACTOR_NUM) / FACTOR_DEN;
      const newPrice = await bondingToken.read.currentPrice();
      expect(newPrice).to.equal(expectedPrice);
    });

    it("Should refund excess ETH if overpaid", async function () {
      const { bondingToken, BASE_PRICE, ownerAddress, publicClient } = await loadFixture(deployBondingCurveTokenFixture);
      const amountToBuy = 1n;
      const cost = BASE_PRICE;
      const overpaid = cost + 1n; // 1 wei over
    
      // Get buyer's balance before the transaction.
      const balanceBefore = await publicClient.getBalance({ address: ownerAddress });
    
      // Execute buyTokens transaction.
      const tx = await bondingToken.write.buyTokens([amountToBuy], { value: overpaid });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      
      // Get buyer's balance after the transaction.
      const balanceAfter = await publicClient.getBalance({ address: ownerAddress });
    
      // Compute gas cost incurred from the transaction.
      const gasUsed = BigInt(receipt.gasUsed);
      const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
      const gasCost = gasUsed * effectiveGasPrice;
    
      // The expected deduction from the buyer's balance equals the token cost plus the gas cost.
      expect(balanceBefore - balanceAfter).to.equal(cost + gasCost);
    
      // Verify event emission.
      const events = await bondingToken.getEvents.TokensBought();
      expect(events[0].args.cost).to.equal(cost);
    });

    it("Should revert when ETH sent is insufficient", async function () {
      const { bondingToken, BASE_PRICE } = await loadFixture(deployBondingCurveTokenFixture);
      const amountToBuy = 1n;
      // Sending 1 wei less than needed.
      const insufficient = BASE_PRICE - 1n;
      await expect(
        bondingToken.write.buyTokens([amountToBuy], { value: insufficient })
      ).to.be.rejected;
    });

    it("Should revert when buying zero tokens", async function () {
      const { bondingToken, BASE_PRICE } = await loadFixture(deployBondingCurveTokenFixture);
      await expect(
        bondingToken.write.buyTokens([0n], { value: BASE_PRICE })
      ).to.be.rejected;
    });
  });

  describe("Selling Tokens", function () {
    it("Should allow selling one token after buying two tokens and update the price correctly", async function () {
      const { bondingToken, ownerAddress, BASE_PRICE, FACTOR_NUM, FACTOR_DEN } = await loadFixture(deployBondingCurveTokenFixture);
  
      // Calculate the cost for two tokens:
      // For the first token, cost = BASE_PRICE.
      // After the first token, new price = (BASE_PRICE * FACTOR_NUM) / FACTOR_DEN.
      // For the second token, cost = new price.
      const priceAfterToken1 = (BASE_PRICE * FACTOR_NUM) / FACTOR_DEN;
      const costToken2 = priceAfterToken1;
      const totalCost = BASE_PRICE + costToken2;
  
      // Buy two tokens.
      await bondingToken.write.buyTokens([2n], { value: totalCost });
  
      // currentPrice after buying two tokens should be:
      // priceAfterBuy = (BASE_PRICE * FACTOR_NUM / FACTOR_DEN) updated again: priceAfterBuy = priceAfterToken1 * FACTOR_NUM/FACTOR_DEN
      const priceAfterBuy = await bondingToken.read.currentPrice();
      
      // For selling one token, the sale proceeds is equal to the current price at the start of sale.
      const saleProceeds = priceAfterBuy;
      
      // Expected new price after selling one token:
      // newPrice = saleStartPrice * (FACTOR_DEN / FACTOR_NUM)
      const expectedNewPrice = (priceAfterBuy * FACTOR_DEN) / FACTOR_NUM;
      
      // Sell one token.
      await bondingToken.write.sellTokens([1n]);
  
      // Verify tokens sold event.
      const events = await bondingToken.getEvents.TokensSold();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.seller).to.equal(await ownerAddress);
      expect(events[0].args.amount).to.equal(1n);
      expect(events[0].args.cost).to.equal(saleProceeds);
  
      // Verify owner's token balance is now 1 (2 bought - 1 sold).
      const balance = await bondingToken.read.balanceOf([ownerAddress]);
      expect(balance).to.equal(1n);
  
      // Verify new current price is updated correctly.
      const newPrice = await bondingToken.read.currentPrice();
      expect(newPrice).to.equal(expectedNewPrice);
    });

    it("Should revert when selling zero tokens", async function () {
      const { bondingToken } = await loadFixture(deployBondingCurveTokenFixture);
      await expect(bondingToken.write.sellTokens([0n])).to.be.rejected;
    });

    it("Should revert when seller does not have enough tokens", async function () {
      const { bondingToken } = await loadFixture(deployBondingCurveTokenFixture);
      await expect(bondingToken.write.sellTokens([1n])).to.be.rejected;
    });
  });

  describe("Withdrawals", function () {
    it("Should allow the owner to withdraw ETH", async function () {
      const { bondingToken, owner, BASE_PRICE, publicClient } = await loadFixture(deployBondingCurveTokenFixture);
      // Buy a token to inject ETH into the contract.
      await bondingToken.write.buyTokens([1n], { value: BASE_PRICE });
      const contractBalanceBefore = await publicClient.getBalance({ address: bondingToken.address });
      expect(contractBalanceBefore).to.equal(BASE_PRICE);

      // Owner withdraws the ETH.
      const tx = await bondingToken.write.withdraw([BASE_PRICE]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      const contractBalanceAfter = await publicClient.getBalance({ address: bondingToken.address });
      expect(contractBalanceAfter).to.equal(0n);
    });

    it("Should revert when a non-owner attempts to withdraw", async function () {
      const { bondingToken, otherAccount, BASE_PRICE } = await loadFixture(deployBondingCurveTokenFixture);
      // Inject ETH into the contract.
      await bondingToken.write.buyTokens([1n], { value: BASE_PRICE });
      // Retrieve a contract instance connected to a non-owner.
      const bondingTokenAsOther = await hre.viem.getContractAt("BondingCurveToken", bondingToken.address, { client: { wallet: otherAccount } });
      await expect(bondingTokenAsOther.write.withdraw([BASE_PRICE])).to.be.rejected;
    });
  });

  describe("Buying and Selling Many Tokens", () => { 
    it("Mint 100 tokens → Check price increase. Mint another 100 tokens → Ensure price is correctly calculated. Sell 50 tokens → Verify that the price goes down as expected.", async function () {
      const { bondingToken, ownerAddress, BASE_PRICE, FACTOR_NUM, FACTOR_DEN } = await loadFixture(deployBondingCurveTokenFixture);
    
      // Helper function to compute total cost and final price for buying `n` tokens,
      // starting from an initial price.
      function computeBuy(tokens: bigint, startPrice: bigint): { cost: bigint, newPrice: bigint } {
        let cost = 0n;
        let price = startPrice;
        for (let i = 0n; i < tokens; i++) {
          cost += price;
          price = (price * FACTOR_NUM) / FACTOR_DEN;
        }
        return { cost, newPrice: price };
      }
    
      // Helper function to compute total refund (sale proceeds) and final price for selling `n` tokens,
      // starting from the sale start price.
      function computeSell(tokens: bigint, startPrice: bigint): { proceeds: bigint, newPrice: bigint } {
        let proceeds = 0n;
        let price = startPrice;
        for (let i = 0n; i < tokens; i++) {
          proceeds += price;
          price = (price * FACTOR_DEN) / FACTOR_NUM;
        }
        return { proceeds, newPrice: price };
      }
    
      // STEP 1: Mint 100 tokens.
      const tokensToBuy1 = 100n;
      const { cost: cost100, newPrice: priceAfter100 } = computeBuy(tokensToBuy1, BASE_PRICE);
      await bondingToken.write.buyTokens([tokensToBuy1], { value: cost100 });
      let currentPrice = await bondingToken.read.currentPrice();
      expect(currentPrice).to.equal(priceAfter100);
    
      // STEP 2: Mint another 100 tokens.
      const tokensToBuy2 = 100n;
      const { cost: costNext100, newPrice: priceAfter200 } = computeBuy(tokensToBuy2, priceAfter100);
      await bondingToken.write.buyTokens([tokensToBuy2], { value: costNext100 });
      currentPrice = await bondingToken.read.currentPrice();
      expect(currentPrice).to.equal(priceAfter200);
    
      // STEP 3: Sell 50 tokens.
      const tokensToSell = 50n;
      const { proceeds: saleProceeds, newPrice: priceAfterSell } = computeSell(tokensToSell, priceAfter200);
      await bondingToken.write.sellTokens([tokensToSell]);
      currentPrice = await bondingToken.read.currentPrice();
      expect(currentPrice).to.equal(priceAfterSell);
    
      // Verify owner's token balance: 100 + 100 - 50 = 150 tokens.
      const balance = await bondingToken.read.balanceOf([ownerAddress]);
      expect(balance).to.equal(150n);
    
      // Optionally check the TokensSold event.
      const events = await bondingToken.getEvents.TokensSold();
      // Find the latest sale event.
      const latestEvent = events[events.length - 1];
      expect(latestEvent.args.seller).to.equal(ownerAddress);
      expect(latestEvent.args.amount).to.equal(tokensToSell);
      expect(latestEvent.args.cost).to.equal(saleProceeds);
    });
  })
});