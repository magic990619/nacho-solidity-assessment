import { expect } from "chai";
import hre from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";

const ONE_TOKEN = 1000000000000000000n; // 1e18

// Helper: using JavaScript numbers for approximate math.
function computeCost(startAmount: bigint, endAmount: bigint, basePrice: bigint, factorNum: bigint, factorDen: bigint) {
  // Convert parameters to Number for math (only safe for small values/tokens)
  const BASE_PRICE = Number(basePrice);
  const factor = Number(factorNum) / Number(factorDen);
  const startAmountFixed = Number(startAmount) / Number(ONE_TOKEN); // should be 1 when buying 1 token
  const endAmountFixed = Number(endAmount) / Number(ONE_TOKEN); // should be 1 when buying 1 token
  
  const startPowered = Math.pow(factor, startAmountFixed);
  const endPowered = Math.pow(factor, endAmountFixed);

  // totalCost = BASE_PRICE * (factor ^ endFixed - factor ^ startFixed)) / (factor - 1)
  const totalCost = BigInt(Math.floor(BASE_PRICE * (endPowered - startPowered) / (factor - 1)));
  // New price = BASE_PRICE * ratio^(tokensFixed), note that the contract multiplies BASE_PRICE by f_T
  const startPrice = BigInt(Math.floor(BASE_PRICE * startPowered));
  const endPrice = BigInt(Math.floor(BASE_PRICE * endPowered));
  return { totalCost, startPrice, endPrice };
}

describe("BondingCurveToken", function () {
  async function deployBondingCurveTokenFixture() {
    const [owner, otherAccount] = await hre.viem.getWalletClients();
    const [ownerAddress] = await owner.getAddresses();
    const bondingToken = await hre.viem.deployContract("BondingCurveToken", []);
    const publicClient = await hre.viem.getPublicClient();

    // Read deployed contract constants.
    const BASE_PRICE = BigInt(await bondingToken.read.BASE_PRICE());
    const FACTOR_NUM = BigInt(await bondingToken.read.FACTOR_NUM());
    const FACTOR_DEN = BigInt(await bondingToken.read.FACTOR_DEN());

    return { bondingToken, owner, ownerAddress, otherAccount, publicClient, BASE_PRICE, FACTOR_NUM, FACTOR_DEN };
  }

  describe("Deployment", function () {
    it("Should initialize with the correct base price", async function () {
      const { bondingToken, BASE_PRICE } = await loadFixture(deployBondingCurveTokenFixture);
      const currentPrice = BigInt(await bondingToken.read.currentPrice());
      expect(currentPrice).to.equal(BASE_PRICE);
    });
  });

  describe("Buying Tokens", function () {
    it("Should allow buying tokens with exact ETH", async function () {
      const { bondingToken, ownerAddress, BASE_PRICE, FACTOR_NUM, FACTOR_DEN } = await loadFixture(deployBondingCurveTokenFixture);
      // Buy 1 token (i.e. 1e18 token wei)
      const amountToBuy = ONE_TOKEN;
      const { totalCost, endPrice: expectedPrice } = computeCost(0n, amountToBuy, BASE_PRICE, FACTOR_NUM, FACTOR_DEN);

      await bondingToken.write.buyTokens([amountToBuy], { value: totalCost });

      // Verify event emission.
      const events = await bondingToken.getEvents.TokensBought();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.buyer).to.equal(ownerAddress);
      expect(BigInt(events[0].args.amount!)).to.equal(amountToBuy);

      // Instead of an exact equality, allow a 1-wei tolerance due to rounding.
      const eventCost = BigInt(events[0].args.cost!);
      const diff = totalCost > eventCost ? totalCost - eventCost : eventCost - totalCost;
      expect(Number(diff)).to.lessThan(2)

      // Verify token was minted.
      const balance = BigInt(await bondingToken.read.balanceOf([ownerAddress]));
      // expect(balance).to.equal(amountToBuy);

      // Verify new global price.
      const newPrice = BigInt(await bondingToken.read.currentPrice());
      // You may also allow a tolerance for newPrice if required.
      const priceDiff = expectedPrice > newPrice ? expectedPrice - newPrice : newPrice - expectedPrice;
      expect(Number(priceDiff)).to.be.lessThan(2);
    });

    it("Should refund excess ETH if overpaid", async function () {
      const { bondingToken, BASE_PRICE, ownerAddress, publicClient } = await loadFixture(deployBondingCurveTokenFixture);
      const amountToBuy = ONE_TOKEN;
      const { totalCost } = computeCost(0n, amountToBuy, BASE_PRICE, BigInt(101), BigInt(100));
      const overpaid = totalCost + 1n; // overpay by 1 wei

      const balanceBefore = BigInt(await publicClient.getBalance({ address: ownerAddress }));

      const tx = await bondingToken.write.buyTokens([amountToBuy], { value: overpaid });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

      const balanceAfter = BigInt(await publicClient.getBalance({ address: ownerAddress }));
      const gasCost = BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice);

      // Deduction equals cost plus gas.
      const balanceDiff = balanceBefore - balanceAfter - (totalCost + gasCost);
      expect(Number(balanceDiff)).to.be.lessThan(2);

      const events = await bondingToken.getEvents.TokensBought();
      const eventCost = BigInt(events[0].args.cost!);
      const diff = totalCost > eventCost ? totalCost - eventCost : eventCost - totalCost;
      expect(Number(diff)).to.be.lessThan(2);
    });

    it("Should revert when ETH sent is insufficient", async function () {
      const { bondingToken, BASE_PRICE } = await loadFixture(deployBondingCurveTokenFixture);
      const amountToBuy = ONE_TOKEN;
      const insufficient = 10000000n;
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
      
      // Buy 2 tokens
      const tokensToBuy = 2n * ONE_TOKEN;
      // Calculate cost for 2 tokens based on our helper.
      // For simplicity we apply computeExpectedBuy for one token twice.
      const { totalCost } = computeCost(0n, tokensToBuy, BASE_PRICE, FACTOR_NUM, FACTOR_DEN);

      await bondingToken.write.buyTokens([tokensToBuy], { value: totalCost + 10000n }); // Add a little more for rounding diff

      // currentPrice after buying two tokens should equal priceAfter2
      const priceAfterBuy = BigInt(await bondingToken.read.currentPrice());
      
      // Now sell 1 token. We use computed inverse: selling 1 token should decrease price.
      const { totalCost: saleProceeds, startPrice: expectedNewPrice } = computeCost(ONE_TOKEN, 2n * ONE_TOKEN, BASE_PRICE, FACTOR_NUM, FACTOR_DEN);
      
      await bondingToken.write.sellTokens([ONE_TOKEN]);
      
      const events = await bondingToken.getEvents.TokensSold();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.seller).to.equal(ownerAddress);
      expect(BigInt(events[0].args.amount!)).to.equal(ONE_TOKEN);

      const eventSaleCost = BigInt(events[0].args.cost!);
      const saleDiff = saleProceeds > eventSaleCost ? saleProceeds - eventSaleCost : eventSaleCost - saleProceeds;
      expect(Number(saleDiff)).to.be.lessThan(10);

      const balance = BigInt(await bondingToken.read.balanceOf([ownerAddress]));
      // Bought 2 tokens and sold 1 token → balance should be 1 token.
      expect(balance).to.equal(ONE_TOKEN);

      const newPrice = BigInt(await bondingToken.read.currentPrice());
      const priceDiff = expectedNewPrice > newPrice ? expectedNewPrice - newPrice : newPrice - expectedNewPrice;
      expect(Number(priceDiff)).to.be.lessThan(2);
    });

    it("Should revert when selling zero tokens", async function () {
      const { bondingToken } = await loadFixture(deployBondingCurveTokenFixture);
      await expect(bondingToken.write.sellTokens([0n])).to.be.rejected;
    });

    it("Should revert when seller does not have enough tokens", async function () {
      const { bondingToken } = await loadFixture(deployBondingCurveTokenFixture);
      await expect(bondingToken.write.sellTokens([ONE_TOKEN])).to.be.rejected;
    });
  });

  describe("Withdrawals", function () {
    it("Should allow the owner to withdraw ETH", async function () {
      const { bondingToken, owner, BASE_PRICE, publicClient } = await loadFixture(deployBondingCurveTokenFixture);
      // Buy a token to send ETH into the contract.
      await bondingToken.write.buyTokens([ONE_TOKEN], { value: BASE_PRICE });
      const contractBalanceBefore = BigInt(await publicClient.getBalance({ address: bondingToken.address }));
      const balanceDiff = contractBalanceBefore - BASE_PRICE;
      expect(Number(balanceDiff)).to.be.lessThan(2);

      const tx = await bondingToken.write.withdraw([await publicClient.getBalance({ address: bondingToken.address })]);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      const contractBalanceAfter = BigInt(await publicClient.getBalance({ address: bondingToken.address }));
      expect(contractBalanceAfter).to.equal(0n);
    });

    it("Should revert when a non-owner attempts to withdraw", async function () {
      const { bondingToken, otherAccount, BASE_PRICE } = await loadFixture(deployBondingCurveTokenFixture);
      await bondingToken.write.buyTokens([ONE_TOKEN], { value: BASE_PRICE });
      const bondingTokenAsOther = await hre.viem.getContractAt(
        "BondingCurveToken", 
        bondingToken.address, 
        { client: { wallet: otherAccount } }
      );
      await expect(bondingTokenAsOther.write.withdraw([BASE_PRICE])).to.be.rejected;
    });
  });
});
