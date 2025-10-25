import { GenericContractsDeclaration } from "~~/utils/scaffold-eth/contract";

/**
 * External contracts configuration
 * Includes USDC on Monad Testnet for payment approvals
 */
const externalContracts = {
  10143: {
    // Monad Testnet (Chain ID: 10143 / 0x279f)
    USDC: {
      address: "0xf817257fed379853cDe0fa4F97AB987181B1E5Ea",
      abi: [
        {
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
          ],
          name: "allowance",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    },
    WETH: {
      address: "0xB5a30b0Dc5EA4A5f0DcC5EA9760c844bF9Fb37",
      abi: [
        {
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "approve",
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    },
    WMON: {
      address: "0x760AFe86e5d5Fa0EE542F7B713713E1c0dd59701",
      abi: [
        {
          inputs: [],
          name: "deposit",
          outputs: [],
          stateMutability: "payable",
          type: "function",
        },
        {
          inputs: [{ name: "wad", type: "uint256" }],
          name: "withdraw",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    },
    UniswapV2Router02: {
      address: "0xfB8e1C3b833f9E67a71C859a132cf783b645e436",
      abi: [
        {
          inputs: [
            { name: "amountOut", type: "uint256" },
            { name: "amountInMax", type: "uint256" },
            { name: "path", type: "address[]" },
            { name: "to", type: "address" },
            { name: "deadline", type: "uint256" },
          ],
          name: "swapTokensForExactTokens",
          outputs: [{ name: "amounts", type: "uint256[]" }],
          stateMutability: "nonpayable",
          type: "function",
        },
        {
          inputs: [
            { name: "amountOut", type: "uint256" },
            { name: "path", type: "address[]" },
          ],
          name: "getAmountsIn",
          outputs: [{ name: "amounts", type: "uint256[]" }],
          stateMutability: "view",
          type: "function",
        },
      ],
    },
  },
} as const;

export default externalContracts satisfies GenericContractsDeclaration;
