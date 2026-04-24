import { expect } from "chai";
import { ethers } from "hardhat";

describe("ARCNameRegistry", () => {
  it("registers and resolves a name with commit-reveal", async () => {
    const [owner, user] = await ethers.getSigners();

    const token = await ethers.deployContract("MockUSDC");
    await token.waitForDeployment();
    await token.connect(owner).mint(user.address, 100_000_000n);

    const registry = await ethers.deployContract("ARCNameRegistry", [
      owner.address,
      await token.getAddress(),
      owner.address,
      5_000_000n,
      50_000_000n
    ]);
    await registry.waitForDeployment();

    await token.connect(user).approve(await registry.getAddress(), 5_000_000n);
    const labelHash = ethers.solidityPackedKeccak256(["string"], ["david"]);
    const salt = ethers.randomBytes(32);
    const commitment = ethers.solidityPackedKeccak256(
      ["address", "bytes32", "bytes32"],
      [user.address, labelHash, salt]
    );
    await registry.connect(user).submitCommitment(commitment);
    await registry.connect(user).registerWithCommit("david.arc", user.address, salt);

    const resolved = await registry.resolve("david");
    expect(resolved).to.equal(user.address);
  });
});
