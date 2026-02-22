import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
  formatEther,
  type Address,
  type Hash,
  type WalletClient,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  MONAD_CHAIN,
  MONAD_MAINNET,
  AGENT_WHEEL_ABI,
  POLICY_ENGINE_ABI,
  ERC_8004_ADDRESSES,
  STAKING_PRECOMPILE,
  STAKING_ABI,
  ERC20_ABI,
  TOKEN_ADDRESSES,
  TOKEN_DECIMALS,
  NATIVE_MON,
  KURU_FLOW_API,
  KURU_FLOW_ENTRYPOINT_MAINNET,
  WMON_ABI,
  DEFAULT_VALIDATOR_ID,
} from './constants.js';
import type {
  ClankerKitConfig,
  WalletInfo,
  PolicyConfig,
  PolicyState,
  TransactionResult,
  PaymentResult,
  SwapParams,
  SwapQuote,
  DelegationInfo,
  EpochInfo,
  KuruFlowQuoteResponse,
  KuruFlowTokenResponse,
  LimitOrderParams,
  MarketOrderParams,
  KuruOrderResult,
  OrderBookData,
  KuruMarketInfo,
  CrossChain,
  CrossChainSwapParams,
  CrossChainSwapResult,
  TokenMetrics,
  TradeStrategy,
  SmartTradeResult,
} from './types.js';
import { KuruCLOB } from './kuru.js';
import { kyberSwap, zeroExSwap } from './crosschain.js';
import { getMemeTokenMetrics, getTokenMetrics, evaluateStrategy } from './memecoin.js';
import type { FlowQuoteFn } from './memecoin.js';

export class ClankerKit {
  private walletAddress: Address;
  private ownerAddress: Address;
  private agentAccount: ReturnType<typeof privateKeyToAccount>;
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private policyEngineAddress?: Address;
  private useTestnet: boolean;
  private chain: typeof MONAD_CHAIN | typeof MONAD_MAINNET;
  private kuruFlowToken?: string;
  private kuruFlowTokenExpiry?: number;
  private _kuruClob?: KuruCLOB;
  private agentPrivateKey: string;
  private rpcUrl: string;

  constructor(
    config: ClankerKitConfig & {
      walletAddress: Address;
      policyEngine?: Address;
      rpcUrl?: string;
      testnet?: boolean;
    }
  ) {
    this.walletAddress = config.walletAddress;
    this.ownerAddress = config.owner;
    this.agentAccount = privateKeyToAccount(config.agentKey);
    this.agentPrivateKey = config.agentKey;
    this.policyEngineAddress = config.policyEngine;
    this.useTestnet = config.testnet ?? true;

    this.chain = this.useTestnet ? MONAD_CHAIN : MONAD_MAINNET;
    this.rpcUrl = config.rpcUrl ?? this.chain.rpcUrls.default.http[0];

    this.walletClient = createWalletClient({
      account: this.agentAccount,
      chain: this.chain,
      transport: http(this.rpcUrl),
    });

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    });
  }

  get address(): Address {
    return this.walletAddress;
  }

  get owner(): Address {
    return this.ownerAddress;
  }

  get agent(): Address {
    return this.agentAccount.address;
  }

  async getBalance(): Promise<bigint> {
    return this.publicClient.getBalance({ address: this.walletAddress });
  }

  async getTokenBalance(tokenAddress: Address): Promise<bigint> {
    const balance = await this.publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.walletAddress],
    });
    return balance as bigint;
  }

  async getInfo(): Promise<WalletInfo> {
    const balance = await this.getBalance();

    let policies: PolicyState | undefined;
    if (this.policyEngineAddress) {
      policies = await this.getPolicyState();
    }

    return {
      address: this.walletAddress,
      owner: this.ownerAddress,
      agent: this.agentAccount.address,
      balance,
      policies,
    };
  }

  async send(to: Address, amount: bigint): Promise<TransactionResult> {
    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [to, amount, '0x'],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  async sendToken(
    token: Address,
    to: Address,
    amount: bigint
  ): Promise<TransactionResult> {
    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'transferToken',
      args: [token, to, amount],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  async execute(
    target: Address,
    value: bigint,
    data: `0x${string}`
  ): Promise<TransactionResult> {
    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [target, value, data],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  /**
   * Ensure the agent EOA has enough MON for gas.
   * If the EOA balance is below `minBalance`, sends `topUpAmount` from the
   * AgentWallet contract to the EOA.
   *
   * @param minBalance  - Minimum acceptable EOA balance (default: 0.01 MON)
   * @param topUpAmount - Amount to send if below minimum (default: 0.05 MON)
   * @returns Object with funded=true and tx hash if topped up, funded=false if already sufficient
   */
  async ensureGas(
    minBalance: bigint = parseEther('0.01'),
    topUpAmount: bigint = parseEther('0.05'),
  ): Promise<{ funded: boolean; hash?: `0x${string}`; eoaBalance: bigint; walletBalance: bigint }> {
    const [eoaBalance, walletBalance] = await Promise.all([
      this.publicClient.getBalance({ address: this.agentAccount.address }),
      this.publicClient.getBalance({ address: this.walletAddress }),
    ]);

    if (eoaBalance >= minBalance) {
      return { funded: false, eoaBalance, walletBalance };
    }

    // Cap topUpAmount to wallet balance (leave a small buffer)
    const available = walletBalance > parseEther('0.001')
      ? walletBalance - parseEther('0.001')
      : 0n;

    if (available <= 0n) {
      throw new Error(
        `Wallet balance too low to fund EOA gas. ` +
        `EOA: ${formatEther(eoaBalance)} MON, Wallet: ${formatEther(walletBalance)} MON. ` +
        `Please send MON to the wallet at ${this.walletAddress}`
      );
    }

    const sendAmount = topUpAmount > available ? available : topUpAmount;

    const result = await this.send(this.agentAccount.address, sendAmount);

    if (result.status !== 'success') {
      throw new Error(`Failed to fund EOA gas: tx ${result.hash} failed`);
    }

    const newEoaBalance = await this.publicClient.getBalance({ address: this.agentAccount.address });

    return {
      funded: true,
      hash: result.hash,
      eoaBalance: newEoaBalance,
      walletBalance: walletBalance - sendAmount,
    };
  }

  async createPolicy(config: PolicyConfig): Promise<TransactionResult> {
    if (!this.policyEngineAddress) {
      throw new Error('Policy engine address not configured');
    }

    // PolicyEngine.createPolicy requires msg.sender == wallet.
    // We route through AgentWallet.execute() so that msg.sender is the wallet contract.
    const calldata = encodeFunctionData({
      abi: POLICY_ENGINE_ABI,
      functionName: 'createPolicy',
      args: [
        this.walletAddress,
        config.dailyLimit ?? 0n,
        config.weeklyLimit ?? 0n,
        config.allowedTokens ?? [],
        config.allowedContracts ?? [],
        config.requireApprovalAbove ?? 0n,
      ],
    });

    return this.execute(this.policyEngineAddress, 0n, calldata);
  }

  async getPolicyState(): Promise<PolicyState> {
    if (!this.policyEngineAddress) {
      throw new Error('Policy engine address not configured');
    }

    const result = (await this.publicClient.readContract({
      address: this.policyEngineAddress,
      abi: POLICY_ENGINE_ABI,
      functionName: 'getPolicy',
      args: [this.walletAddress],
    })) as [boolean, bigint, bigint, bigint, bigint, bigint];

    return {
      isActive: result[0],
      dailyLimit: result[1],
      weeklyLimit: result[2],
      dailySpent: result[3],
      weeklySpent: result[4],
      requireApprovalAbove: result[5],
    };
  }

  async updateDailyLimit(newLimit: bigint): Promise<TransactionResult> {
    if (!this.policyEngineAddress) {
      throw new Error('Policy engine address not configured');
    }

    // PolicyEngine.updateDailyLimit requires msg.sender == wallet.
    const calldata = encodeFunctionData({
      abi: POLICY_ENGINE_ABI,
      functionName: 'updateDailyLimit',
      args: [this.walletAddress, newLimit],
    });

    return this.execute(this.policyEngineAddress, 0n, calldata);
  }

  async pay(
    endpoint: string,
    amount: number
  ): Promise<PaymentResult> {
    const x402 = await import('@x402/fetch');
    const { wrapFetchWithPayment } = x402;
    const { ExactEvmScheme } = await import('@x402/evm');
    const { x402Client } = await import('@x402/core/client');

    const chainId = this.useTestnet ? 'eip155:10143' : 'eip155:143';

    const evmSigner = {
      address: this.agentAccount.address,
      signTypedData: async (message: {
        domain: Record<string, unknown>;
        types: Record<string, unknown>;
        primaryType: string;
        message: Record<string, unknown>;
      }) => {
        return this.agentAccount.signTypedData({
          domain: message.domain as Parameters<
            typeof this.agentAccount.signTypedData
          >[0]['domain'],
          types: message.types as Parameters<
            typeof this.agentAccount.signTypedData
          >[0]['types'],
          primaryType: message.primaryType,
          message: message.message,
        });
      },
    };

    const exactScheme = new ExactEvmScheme(evmSigner as any);
    const client = new x402Client().register(chainId as any, exactScheme);

    const paymentFetch = wrapFetchWithPayment(fetch, client);

    try {
      const response = await paymentFetch(endpoint, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        return { success: true };
      }

      return {
        success: false,
        error: `Payment failed: ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async registerAsAgent(
    name: string,
    description: string
  ): Promise<TransactionResult> {
    const identityRegistry = this.useTestnet
      ? ERC_8004_ADDRESSES.testnet.identityRegistry
      : ERC_8004_ADDRESSES.mainnet.identityRegistry;

    const agentCard = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name,
      description,
      services: [
        {
          name: 'ClankerKit',
          endpoint: this.walletAddress,
        },
      ],
      x402Support: true,
      active: true,
      supportedTrust: ['reputation'],
    };

    const agentURI = `data:application/json;base64,${Buffer.from(
      JSON.stringify(agentCard)
    ).toString('base64')}`;

    const hash = await this.walletClient.writeContract({
      address: identityRegistry,
      abi: [
        {
          inputs: [
            { name: 'agentURI', type: 'string' },
            { name: 'metadata', type: 'tuple[]' },
          ],
          name: 'register',
          outputs: [{ name: 'agentId', type: 'uint256' }],
          stateMutability: 'nonpayable',
          type: 'function',
        },
      ],
      functionName: 'register',
      args: [agentURI, []],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  private resolveToken(token: string): Address {
    if (token.toUpperCase() === 'MON') {
      return NATIVE_MON;
    }

    if (token.startsWith('0x') && token.length === 42) {
      return token as Address;
    }

    const tokens = this.useTestnet ? TOKEN_ADDRESSES.testnet : TOKEN_ADDRESSES.mainnet;
    const address = (tokens as Record<string, Address>)[token.toUpperCase()];

    if (!address) {
      throw new Error(`Unknown token: ${token}. Available: ${Object.keys(tokens).join(', ')}`);
    }

    return address;
  }

  /**
   * Reverse-resolve a token address to its known symbol.
   * Returns the human-readable symbol (e.g. "USDC", "CHOG") for known addresses,
   * or a shortened address (e.g. "0x7547...b603") for unknown ones.
   *
   * Handles both checksummed and lowercased addresses.
   */
  resolveTokenSymbol(addressOrSymbol: string): string {
    // Already a symbol (not an address)
    if (!addressOrSymbol.startsWith('0x') || addressOrSymbol.length !== 42) {
      return addressOrSymbol.toUpperCase();
    }

    // Native MON
    if (addressOrSymbol.toLowerCase() === NATIVE_MON.toLowerCase()) {
      return 'MON';
    }

    // Search both testnet and mainnet address maps
    const networks = [TOKEN_ADDRESSES.mainnet, TOKEN_ADDRESSES.testnet];
    for (const tokens of networks) {
      for (const [symbol, addr] of Object.entries(tokens)) {
        if ((addr as string).toLowerCase() === addressOrSymbol.toLowerCase()) {
          return symbol;
        }
      }
    }

    // Unknown — return shortened address
    return `${addressOrSymbol.slice(0, 6)}...${addressOrSymbol.slice(-4)}`;
  }

  /**
   * Async reverse-resolve: tries local lookup first, then reads on-chain symbol().
   * Caches the result for subsequent calls.
   */
  async fetchTokenSymbol(address: string): Promise<string> {
    // Try local lookup first
    const local = this.resolveTokenSymbol(address);
    if (!local.startsWith('0x')) {
      return local;
    }

    // Try on-chain symbol() call
    if (address.startsWith('0x') && address.length === 42) {
      try {
        const symbol = await this.publicClient.readContract({
          address: address as Address,
          abi: [{ name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }] as const,
          functionName: 'symbol',
        });
        return symbol as string;
      } catch {
        // fallback to shortened address
      }
    }

    return local;
  }

  private async getKuruFlowToken(): Promise<string> {
    if (this.kuruFlowToken && this.kuruFlowTokenExpiry && Date.now() < this.kuruFlowTokenExpiry * 1000) {
      return this.kuruFlowToken;
    }

    const response = await fetch(`${KURU_FLOW_API}/api/generate-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_address: this.agentAccount.address }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get Kuru Flow token: ${response.status}`);
    }

    const data: KuruFlowTokenResponse = await response.json();
    this.kuruFlowToken = data.token;
    this.kuruFlowTokenExpiry = data.expires_at;

    return data.token;
  }

  /**
   * Returns a quote for a token swap.
   *
   * On testnet only MON↔WMON wrap/unwrap is supported (1:1, no DEX).
   * On mainnet full Kuru DEX routing is used via the Kuru Flow API.
   */
  async getSwapQuote(params: SwapParams): Promise<SwapQuote> {
    if (this.useTestnet) {
      return this._getTestnetSwapQuote(params);
    }
    return this._getKuruSwapQuote(params);
  }

  /**
   * Testnet swap: MON → WMON (deposit) or WMON → MON (withdraw). 1:1.
   */
  private _getTestnetSwapQuote(params: SwapParams): SwapQuote {
    const inSymbol = params.tokenIn.toUpperCase();
    const outSymbol = params.tokenOut.toUpperCase();
    const wmonAddress = TOKEN_ADDRESSES.testnet.WMON;

    const isWrap = (inSymbol === 'MON' && outSymbol === 'WMON');
    const isUnwrap = (inSymbol === 'WMON' && outSymbol === 'MON');

    if (!isWrap && !isUnwrap) {
      throw new Error(
        `Kuru DEX is not available on Monad testnet. ` +
        `Only MON↔WMON wrap/unwrap is supported on testnet. ` +
        `Use mainnet for full DEX swaps.`
      );
    }

    if (isWrap) {
      const depositCalldata = encodeFunctionData({
        abi: WMON_ABI,
        functionName: 'deposit',
        args: [],
      });
      return {
        amountOut: params.amount,
        minAmountOut: params.amount,
        transaction: {
          to: wmonAddress,
          calldata: depositCalldata,
          value: params.amount,
        },
      };
    } else {
      // unwrap WMON → MON
      const withdrawCalldata = encodeFunctionData({
        abi: WMON_ABI,
        functionName: 'withdraw',
        args: [params.amount],
      });
      return {
        amountOut: params.amount,
        minAmountOut: params.amount,
        transaction: {
          to: wmonAddress,
          calldata: withdrawCalldata,
          value: 0n,
        },
      };
    }
  }

  /**
   * Mainnet swap via Kuru Flow API (smart router).
   */
  private async _getKuruSwapQuote(params: SwapParams): Promise<SwapQuote> {
    // resolveToken uses mainnet addresses when !useTestnet
    // Kuru Flow API uses 0x0000...0000 for native MON (not the 0xEeee sentinel)
    const tokenIn = this.resolveToken(params.tokenIn);
    const tokenOut = this.resolveToken(params.tokenOut);
    const jwtToken = await this.getKuruFlowToken();

    const response = await fetch(`${KURU_FLOW_API}/api/quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
      },
      body: JSON.stringify({
        userAddress: this.walletAddress,
        tokenIn,
        tokenOut,
        amount: params.amount.toString(),
        slippageTolerance: params.slippage ?? 50,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get swap quote: ${response.status}`);
    }

    const data: KuruFlowQuoteResponse = await response.json();

    // API may return {error, message} without a status field on failure
    if (data.status !== 'success') {
      throw new Error(data.error || data.message || 'Failed to get swap quote');
    }

    return {
      amountOut: BigInt(data.output),
      minAmountOut: BigInt(data.minOut),
      transaction: {
        to: data.transaction.to as Address,
        calldata: (`0x${data.transaction.calldata.replace(/^0x/, '')}`) as `0x${string}`,
        value: BigInt(data.transaction.value || '0'),
      },
    };
  }

  async swap(params: SwapParams): Promise<TransactionResult> {
    if (this.useTestnet) {
      return this._executeTestnetSwap(params);
    }
    return this._executeKuruSwap(params);
  }

  /**
   * Testnet: wrap MON→WMON or unwrap WMON→MON via AgentWallet.execute().
   */
  private async _executeTestnetSwap(params: SwapParams): Promise<TransactionResult> {
    const quote = this._getTestnetSwapQuote(params);
    const inSymbol = params.tokenIn.toUpperCase();

    if (inSymbol === 'WMON') {
      // Need to approve WMON before withdraw (not needed for deposit)
      const wmonAddress = TOKEN_ADDRESSES.testnet.WMON;
      await this.approveTokenIfNeeded(wmonAddress, quote.transaction.to, params.amount);
    }

    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [quote.transaction.to, quote.transaction.value, quote.transaction.calldata],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  /**
   * Mainnet: execute a Kuru-routed swap via AgentWallet.execute().
   */
  private async _executeKuruSwap(params: SwapParams): Promise<TransactionResult> {
    const quote = await this._getKuruSwapQuote(params);
    const tokenIn = this.resolveToken(params.tokenIn);

    if (tokenIn !== NATIVE_MON) {
      await this.approveTokenIfNeeded(tokenIn, quote.transaction.to, params.amount);
    }

    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [quote.transaction.to, quote.transaction.value, quote.transaction.calldata],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  private async approveTokenIfNeeded(
    token: Address,
    spender: Address,
    amount: bigint
  ): Promise<void> {
    const allowance = await this.publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [this.walletAddress, spender],
    }) as bigint;

    if (allowance < amount) {
      const approveData = encodeFunctionData({
        abi: [{
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
          ],
          name: 'approve',
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable',
          type: 'function',
        }],
        functionName: 'approve',
        args: [spender, amount],
      });

      const hash = await this.walletClient.writeContract({
        address: this.walletAddress,
        abi: AGENT_WHEEL_ABI,
        functionName: 'execute',
        args: [token, 0n, approveData],
        chain: this.chain,
        account: this.agentAccount,
      } as any);

      await this.publicClient.waitForTransactionReceipt({ hash });
    }
  }

  async stake(
    validatorId: bigint = DEFAULT_VALIDATOR_ID,
    amount: bigint
  ): Promise<TransactionResult> {
    const delegateData = encodeFunctionData({
      abi: STAKING_ABI,
      functionName: 'delegate',
      args: [validatorId],
    });

    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [STAKING_PRECOMPILE, amount, delegateData],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  async unstake(
    validatorId: bigint = DEFAULT_VALIDATOR_ID,
    amount: bigint,
    withdrawId: number = 0
  ): Promise<TransactionResult> {
    const undelegateData = encodeFunctionData({
      abi: STAKING_ABI,
      functionName: 'undelegate',
      args: [validatorId, amount, withdrawId],
    });

    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [STAKING_PRECOMPILE, 0n, undelegateData],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  async withdrawStake(
    validatorId: bigint = DEFAULT_VALIDATOR_ID,
    withdrawId: number = 0
  ): Promise<TransactionResult> {
    const withdrawData = encodeFunctionData({
      abi: STAKING_ABI,
      functionName: 'withdraw',
      args: [validatorId, withdrawId],
    });

    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [STAKING_PRECOMPILE, 0n, withdrawData],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  async claimStakingRewards(
    validatorId: bigint = DEFAULT_VALIDATOR_ID
  ): Promise<TransactionResult> {
    const claimData = encodeFunctionData({
      abi: STAKING_ABI,
      functionName: 'claimRewards',
      args: [validatorId],
    });

    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [STAKING_PRECOMPILE, 0n, claimData],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  async compoundRewards(
    validatorId: bigint = DEFAULT_VALIDATOR_ID
  ): Promise<TransactionResult> {
    const compoundData = encodeFunctionData({
      abi: STAKING_ABI,
      functionName: 'compound',
      args: [validatorId],
    });

    const hash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: AGENT_WHEEL_ABI,
      functionName: 'execute',
      args: [STAKING_PRECOMPILE, 0n, compoundData],
      chain: this.chain,
      account: this.agentAccount,
    } as any);

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    return {
      hash,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };
  }

  async getDelegationInfo(
    validatorId: bigint = DEFAULT_VALIDATOR_ID
  ): Promise<DelegationInfo> {
    const result = await this.publicClient.readContract({
      address: STAKING_PRECOMPILE,
      abi: STAKING_ABI,
      functionName: 'getDelegator',
      args: [validatorId, this.walletAddress],
    }) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint];

    return {
      stake: result[0],
      accRewardPerToken: result[1],
      unclaimedRewards: result[2],
      deltaStake: result[3],
      nextDeltaStake: result[4],
      deltaEpoch: result[5],
      nextDeltaEpoch: result[6],
    };
  }

  async getEpoch(): Promise<EpochInfo> {
    const result = await this.publicClient.readContract({
      address: STAKING_PRECOMPILE,
      abi: STAKING_ABI,
      functionName: 'getEpoch',
      args: [],
    }) as [bigint, boolean];

    return {
      epoch: result[0],
      inEpochDelayPeriod: result[1],
    };
  }

  async getValidatorSet(startIndex: number = 0): Promise<bigint[]> {
    const result = await this.publicClient.readContract({
      address: STAKING_PRECOMPILE,
      abi: STAKING_ABI,
      functionName: 'getExecutionValidatorSet',
      args: [startIndex],
    }) as [boolean, number, bigint[]];

    return result[2];
  }

  // ─── Kuru CLOB ─────────────────────────────────────────────────────────────

  /** Lazy singleton for the Kuru CLOB adapter (mainnet only). */
  private get kuruClob(): KuruCLOB {
    if (!this._kuruClob) {
      this._kuruClob = new KuruCLOB(this.agentPrivateKey, this.rpcUrl);
    }
    return this._kuruClob;
  }

  /** Returns the known Kuru CLOB markets. */
  getKuruMarkets(): KuruMarketInfo[] {
    return this.kuruClob.getKnownMarkets();
  }

  /** Fetch the live L2 orderbook for a Kuru CLOB market. */
  async getOrderBook(marketAddress: string): Promise<OrderBookData> {
    return this.kuruClob.getOrderBook(marketAddress);
  }

  /** Returns best bid / ask / mid for a Kuru CLOB market. */
  async getMarketPrice(
    marketAddress: string
  ): Promise<{ bid?: number; ask?: number; mid?: number }> {
    return this.kuruClob.getMarketPrice(marketAddress);
  }

  /**
   * Place a market (IOC) order on a Kuru CLOB market.
   * The agent EOA must hold the tokens to trade.
   */
  async kuruMarketOrder(params: MarketOrderParams): Promise<KuruOrderResult> {
    return this.kuruClob.marketOrder(params);
  }

  /** Place a limit (GTC) order on a Kuru CLOB market. */
  async kuruLimitOrder(params: LimitOrderParams): Promise<KuruOrderResult> {
    return this.kuruClob.limitOrder(params);
  }

  /** Cancel one or more open orders on a Kuru CLOB market. */
  async cancelKuruOrders(marketAddress: string, orderIds: string[]): Promise<KuruOrderResult> {
    return this.kuruClob.cancelOrders(marketAddress, orderIds);
  }

  /** Estimate base tokens out for a market buy (quote amount in). */
  async estimateKuruBuy(marketAddress: string, quoteAmount: number): Promise<number> {
    return this.kuruClob.estimateMarketBuy(marketAddress, quoteAmount);
  }

  /** Estimate quote tokens out for a market sell (base amount in). */
  async estimateKuruSell(marketAddress: string, baseAmount: number): Promise<number> {
    return this.kuruClob.estimateMarketSell(marketAddress, baseAmount);
  }

  // ─── Cross-chain swaps ──────────────────────────────────────────────────────

  /**
   * Builds a viem WalletClient + PublicClient for a non-Monad EVM chain using
   * the agent EOA private key. Shared by kyberSwap and zeroExSwap.
   */
  private makeChainClient(chain: string) {
    const chainRpc: Record<string, string> = {
      ethereum:  'https://eth.llamarpc.com',
      polygon:   'https://polygon.llamarpc.com',
      arbitrum:  'https://arbitrum.llamarpc.com',
      optimism:  'https://optimism.llamarpc.com',
      base:      'https://base.llamarpc.com',
      bsc:       'https://binance.llamarpc.com',
      avalanche: 'https://avalanche.public-rpc.com',
    };
    const chainIds: Record<string, number> = {
      ethereum: 1, polygon: 137, arbitrum: 42161, optimism: 10,
      base: 8453, bsc: 56, avalanche: 43114,
    };
    const rpc      = chainRpc[chain]  ?? 'https://eth.llamarpc.com';
    const chainId  = chainIds[chain]  ?? 1;
    const account  = privateKeyToAccount(this.agentPrivateKey as `0x${string}`);
    const wc = createWalletClient({ account, chain: { id: chainId } as any, transport: http(rpc) });
    const pc = createPublicClient({ chain: { id: chainId } as any, transport: http(rpc) });
    return { wc, pc, account, chainId };
  }

  /**
   * Builds a send-transaction callback for cross-chain methods.
   * Also returns an approveToken helper for ERC-20 pre-approvals.
   */
  private makeCrossChainCallbacks(chain: string) {
    const { wc, pc, account, chainId } = this.makeChainClient(chain);

    const sendTransaction = async (to: string, value: bigint, data: `0x${string}`) => {
      const hash = await wc.sendTransaction({
        to: to as Address, value, data, account,
        chain: { id: chainId } as any,
      } as any);
      const receipt = await pc.waitForTransactionReceipt({ hash });
      return { hash, status: receipt.status === 'success' ? 'success' : 'failed' } as const;
    };

    const approveToken = async (tokenAddress: string, spender: string, amount: string) => {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spender as Address, BigInt(amount)],
      });
      const hash = await wc.sendTransaction({
        to: tokenAddress as Address, data, account,
        chain: { id: chainId } as any,
      } as any);
      await pc.waitForTransactionReceipt({ hash });
    };

    return { sendTransaction, approveToken };
  }

  /**
   * Cross-chain swap via KyberSwap aggregator.
   * Runs on non-Monad EVM chains. Agent EOA must hold funds on that chain.
   */
  async kyberSwap(params: CrossChainSwapParams): Promise<CrossChainSwapResult> {
    const { sendTransaction, approveToken } = this.makeCrossChainCallbacks(params.chain);
    return kyberSwap(params, this.agentAccount.address, sendTransaction, approveToken);
  }

  /**
   * Cross-chain swap via 0x Swap API v2.
   * Requires ZEROX_API_KEY env var. Agent EOA must hold funds on that chain.
   */
  async zeroExSwap(params: CrossChainSwapParams): Promise<CrossChainSwapResult> {
    const apiKey = (typeof process !== 'undefined' && process.env?.ZEROX_API_KEY) ?? '';
    if (!apiKey) throw new Error('ZEROX_API_KEY environment variable is required for 0x swaps');
    const { sendTransaction, approveToken } = this.makeCrossChainCallbacks(params.chain);
    return zeroExSwap(params, this.agentAccount.address, apiKey, sendTransaction, approveToken);
  }

  // ─── Memecoin / strategy engine ─────────────────────────────────────────────

  /**
   * Build a Kuru Flow quote callback for price fallback.
   * Quotes 1 MON → token via Kuru Flow API (bypasses broken CLOB SDK).
   */
  private makeFlowQuoteFn(): FlowQuoteFn {
    return async (tokenAddress: string) => {
      try {
        const { parseEther } = await import('viem');
        return await this._getKuruSwapQuote({
          tokenIn: 'MON',
          tokenOut: tokenAddress,
          amount: parseEther('1'),
        });
      } catch {
        return null;
      }
    };
  }

  /** Returns live price metrics for all known Monad memecoins. */
  async getMemeTokens(): Promise<TokenMetrics[]> {
    const flowQuote = this.useTestnet ? undefined : this.makeFlowQuoteFn();
    return getMemeTokenMetrics(this.kuruClob, this.useTestnet, flowQuote);
  }

  /** Returns live price metrics for a single token by symbol or address. */
  async getTokenPrice(symbolOrAddress: string): Promise<TokenMetrics> {
    const flowQuote = this.useTestnet ? undefined : this.makeFlowQuoteFn();
    return getTokenMetrics(symbolOrAddress, this.kuruClob, this.useTestnet, flowQuote);
  }

  /**
   * Evaluate and optionally execute a trading strategy for a memecoin.
   *
   * @param token Token symbol, e.g. "DAK", "CHOG", "YAKI"
   * @param strategy Trade strategy config
   * @param autoExecute If true, places the CLOB order when triggered (default false = dry-run)
   */
  async smartTrade(
    token: string,
    strategy: TradeStrategy,
    autoExecute = false
  ): Promise<SmartTradeResult> {
    const clob = this.kuruClob;
    const flowQuote = this.useTestnet ? undefined : this.makeFlowQuoteFn();
    const executeCallback = autoExecute
      ? async (order: MarketOrderParams | LimitOrderParams, type: 'market' | 'limit') => {
          if (type === 'market') {
            const result = await clob.marketOrder(order as MarketOrderParams);
            return { hash: result.hash };
          } else {
            const result = await clob.limitOrder(order as LimitOrderParams);
            return { hash: result.hash };
          }
        }
      : undefined;
    return evaluateStrategy(token, strategy, clob, this.useTestnet, executeCallback, flowQuote);
  }

  getTokenDecimals(token: string): number {
    const symbol = token.toUpperCase();
    if (symbol === 'MON') return 18;
    return TOKEN_DECIMALS[symbol] ?? 18;
  }

  /**
   * Fetch token decimals — tries local lookup first, then reads on-chain decimals().
   * Caches the result for subsequent calls.
   */
  async fetchTokenDecimals(token: string): Promise<number> {
    const symbol = token.toUpperCase();
    // Known symbol
    if (TOKEN_DECIMALS[symbol] !== undefined) return TOKEN_DECIMALS[symbol];
    if (symbol === 'MON') return 18;

    // If it's a contract address, query on-chain
    if (token.startsWith('0x') && token.length === 42) {
      // Check cache first
      if (TOKEN_DECIMALS[token.toLowerCase()] !== undefined) {
        return TOKEN_DECIMALS[token.toLowerCase()];
      }
      try {
        const decimals = await this.publicClient.readContract({
          address: token as Address,
          abi: [{ name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }] as const,
          functionName: 'decimals',
        });
        // Cache it for future calls
        TOKEN_DECIMALS[token.toLowerCase()] = Number(decimals);
        return Number(decimals);
      } catch {
        return 18; // default fallback
      }
    }

    return 18;
  }
}

/**
 * Deploy a new PolicyEngine contract.
 * The deployer (privateKey signer) becomes the owner via Ownable(msg.sender).
 */
export async function deployPolicyEngine(
  privateKey: `0x${string}`,
  opts?: { rpcUrl?: string; testnet?: boolean }
): Promise<{ address: Address; hash: Hash }> {
  const { POLICY_ENGINE_BYTECODE } = await import('./bytecode.js');
  const chain = opts?.testnet ? MONAD_CHAIN : MONAD_MAINNET;
  const rpc = opts?.rpcUrl ?? (chain.rpcUrls.default.http[0] as string);
  const account = privateKeyToAccount(privateKey);
  const wc = createWalletClient({ account, chain, transport: http(rpc) });
  const pc = createPublicClient({ chain, transport: http(rpc) });

  const hash = await wc.deployContract({
    abi: [
      { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
      ...POLICY_ENGINE_ABI,
    ],
    bytecode: POLICY_ENGINE_BYTECODE,
    args: [],
  });

  const receipt = await pc.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`PolicyEngine deployment failed (tx ${hash})`);
  }
  return { address: receipt.contractAddress, hash };
}

/**
 * Deploy a new AgentWallet contract.
 * Constructor: (address _owner, address _agent, address _policyEngine)
 *
 * If no policyEngine is provided, one is deployed first.
 * Returns the wallet address, policy engine address, and deployment tx hash.
 */
export async function deployAgentWallet(
  privateKey: `0x${string}`,
  owner: Address,
  agent: Address,
  opts?: { policyEngine?: Address; rpcUrl?: string; testnet?: boolean }
): Promise<{ walletAddress: Address; policyEngineAddress: Address; hash: Hash }> {
  const { AGENT_WALLET_BYTECODE } = await import('./bytecode.js');
  const chain = opts?.testnet ? MONAD_CHAIN : MONAD_MAINNET;
  const rpc = opts?.rpcUrl ?? (chain.rpcUrls.default.http[0] as string);
  const account = privateKeyToAccount(privateKey);
  const wc = createWalletClient({ account, chain, transport: http(rpc) });
  const pc = createPublicClient({ chain, transport: http(rpc) });

  // Deploy or use existing PolicyEngine
  let policyEngineAddress = opts?.policyEngine;
  if (!policyEngineAddress) {
    const pe = await deployPolicyEngine(privateKey, { rpcUrl: rpc, testnet: opts?.testnet });
    policyEngineAddress = pe.address;
  }

  const hash = await wc.deployContract({
    abi: [
      {
        type: 'constructor',
        inputs: [
          { name: '_owner', type: 'address' },
          { name: '_agent', type: 'address' },
          { name: '_policyEngine', type: 'address' },
        ],
        stateMutability: 'nonpayable',
      },
      ...AGENT_WHEEL_ABI,
    ],
    bytecode: AGENT_WALLET_BYTECODE,
    args: [owner, agent, policyEngineAddress],
  });

  const receipt = await pc.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`AgentWallet deployment failed (tx ${hash})`);
  }
  return {
    walletAddress: receipt.contractAddress,
    policyEngineAddress,
    hash,
  };
}
