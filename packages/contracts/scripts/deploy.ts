import { ethers } from "hardhat";
import { promises as fs } from "node:fs";
import path from "node:path";
import "dotenv/config";

function isTxpoolFull(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = (error as { message?: string }).message || "";
  const shortMessage = (error as { shortMessage?: string }).shortMessage || "";
  const nested = (error as { error?: { message?: string } }).error?.message || "";
  const text = `${message} ${shortMessage} ${nested}`.toLowerCase();
  return text.includes("txpool is full");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || "";
  if (!privateKey) {
    throw new Error(
      "No deployer account configured. Set DEPLOYER_PRIVATE_KEY in .env for arcTestnet deployment."
    );
  }
  const rpcUrl = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);

  const usdc = process.env.USDC_TOKEN_ADDRESS || "0x3600000000000000000000000000000000000000";
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const baseFee = BigInt(process.env.REGISTRATION_FEE_USDC || "5000000");
  const shortFee = BigInt(process.env.SHORT_NAME_FEE_USDC || "50000000");

  const factory = await ethers.getContractFactory("ARCNameRegistry", deployer);
  const maxAttempts = Number(process.env.DEPLOY_MAX_ATTEMPTS || "8");
  const retryDelayMs = Number(process.env.DEPLOY_RETRY_DELAY_MS || "15000");

  let contract: Awaited<ReturnType<typeof factory.deploy>> | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      contract = await factory.deploy(deployer.address, usdc, treasury, baseFee, shortFee);
      await contract.waitForDeployment();
      break;
    } catch (error) {
      if (!isTxpoolFull(error) || attempt === maxAttempts) {
        throw error;
      }
      console.warn(
        `Arc RPC txpool is full (attempt ${attempt}/${maxAttempts}). Retrying in ${retryDelayMs}ms...`
      );
      await sleep(retryDelayMs);
    }
  }

  if (!contract) {
    throw new Error("Deployment failed: no contract instance returned.");
  }

  const address = await contract.getAddress();
  const outPath = path.resolve(__dirname, "../../../deployments/arc-testnet.json");
  const payload = {
    chainId: Number(process.env.ARC_CHAIN_ID || "5042002"),
    network: "arcTestnet",
    registryAddress: address,
    usdcToken: usdc,
    updatedAt: new Date().toISOString()
  };
  await fs.writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("Deployed ARCNameRegistry:", address);
  console.log("Deployment record:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
