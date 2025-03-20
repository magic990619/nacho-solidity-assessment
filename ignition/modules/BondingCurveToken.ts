import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BondingCurveTokenModule = buildModule("BondingCurveToken", (m) => {

  const bondingToken = m.contract("BondingCurveToken", []);

  return { bondingToken };
});

export default BondingCurveTokenModule;
