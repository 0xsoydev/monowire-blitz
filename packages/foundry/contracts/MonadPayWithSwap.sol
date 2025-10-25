// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MonadPay.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Uniswap V2 Router Interface
interface IUniswapV2Router02 {
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
    
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    function getAmountsIn(
        uint256 amountOut,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
    
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}

contract MonadPayWithSwap is MonadPay {
    using SafeERC20 for IERC20;

    // Uniswap V2 Router on Monad Testnet
    IUniswapV2Router02 public immutable uniswapRouter;
    
    // Wrapped MON address
    address public immutable WMON;

    event SwapExecuted(
        bytes32 indexed invoiceId,
        address indexed payer,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _uniswapRouter, address _wmon) {
        require(_uniswapRouter != address(0), "Invalid router address");
        require(_wmon != address(0), "Invalid WMON address");
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        WMON = _wmon;
    }
    
    // Allow contract to receive native MON
    receive() external payable {}

    /**
     * @notice Pay invoice with any token - automatically swaps to required token
     * @param _invoiceId The invoice ID to pay
     * @param _paymentToken The token user wants to pay with
     * @param _maxAmountIn Maximum amount of payment token user is willing to spend
     * @param _path Swap path from payment token to invoice token
     */
    function payInvoiceWithSwap(
        bytes32 _invoiceId,
        address _paymentToken,
        uint256 _maxAmountIn,
        address[] calldata _path
    ) external nonReentrant {
        require(invoiceExists[_invoiceId], "Invoice does not exist");
        Invoice storage invoice = invoices[_invoiceId];
        require(!invoice.paid, "Invoice already paid");

        // Validate swap path
        require(_path.length >= 2, "Invalid swap path");
        require(_path[0] == _paymentToken, "Path must start with payment token");
        require(_path[_path.length - 1] == invoice.token, "Path must end with invoice token");

        // If payment token is same as invoice token, just pay directly
        if (_paymentToken == invoice.token) {
            _executeDirectPayment(_invoiceId, invoice);
            return;
        }

        // Get expected amount needed for swap
        uint256[] memory amountsIn = uniswapRouter.getAmountsIn(invoice.amount, _path);
        uint256 requiredAmountIn = amountsIn[0];
        
        require(requiredAmountIn <= _maxAmountIn, "Insufficient max amount");

        // Transfer payment tokens from user to this contract
        IERC20(_paymentToken).safeTransferFrom(msg.sender, address(this), requiredAmountIn);

        // Approve Uniswap router to spend payment tokens
        IERC20(_paymentToken).forceApprove(address(uniswapRouter), requiredAmountIn);

        // Execute swap to get exact amount needed for invoice
        uint256[] memory amounts = uniswapRouter.swapTokensForExactTokens(
            invoice.amount,
            requiredAmountIn,
            _path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );

        emit SwapExecuted(
            _invoiceId,
            msg.sender,
            _paymentToken,
            invoice.token,
            amounts[0],
            amounts[amounts.length - 1]
        );

        // Distribute to recipients
        IERC20 token = IERC20(invoice.token);
        for (uint256 i = 0; i < invoice.splits.length; i++) {
            uint256 splitAmount = (invoice.amount * invoice.splits[i].basisPoints) / 10000;
            token.safeTransfer(invoice.splits[i].recipient, splitAmount);

            emit SplitDistributed(
                _invoiceId,
                invoice.splits[i].recipient,
                splitAmount
            );
        }

        // Mark invoice as paid
        invoice.paid = true;
        invoice.paidAt = block.timestamp;
        invoice.paidBy = msg.sender;

        emit InvoicePaid(_invoiceId, msg.sender, invoice.amount, invoice.token);
    }

    /**
     * @notice Pay invoice with native MON - automatically swaps to required token
     * @param _invoiceId The invoice ID to pay
     * @dev User sends native MON with the transaction (msg.value)
     */
    function payInvoiceWithNativeMON(bytes32 _invoiceId) external payable nonReentrant {
        require(invoiceExists[_invoiceId], "Invoice does not exist");
        Invoice storage invoice = invoices[_invoiceId];
        require(!invoice.paid, "Invoice already paid");
        require(msg.value > 0, "Must send MON");

        // Path: WMON -> invoice.token (usually USDC)
        address[] memory path = new address[](2);
        path[0] = WMON;
        path[1] = invoice.token;

        // Get expected output for the MON we're sending
        uint256[] memory expectedAmounts = uniswapRouter.getAmountsOut(msg.value, path);
        uint256 expectedOutput = expectedAmounts[1];
        
        require(expectedOutput >= invoice.amount, "Insufficient MON sent");

        // Swap native MON for invoice token (with 1% slippage tolerance)
        uint256 minOut = (invoice.amount * 99) / 100;
        uint256[] memory amounts = uniswapRouter.swapExactETHForTokens{value: msg.value}(
            minOut,
            path,
            address(this),
            block.timestamp + 300
        );

        emit SwapExecuted(
            _invoiceId,
            msg.sender,
            address(0), // Native token
            invoice.token,
            msg.value,
            amounts[1]
        );

        // Distribute to recipients
        IERC20 token = IERC20(invoice.token);
        uint256 received = amounts[1];
        
        for (uint256 i = 0; i < invoice.splits.length; i++) {
            uint256 splitAmount = (received * invoice.splits[i].basisPoints) / 10000;
            token.safeTransfer(invoice.splits[i].recipient, splitAmount);

            emit SplitDistributed(
                _invoiceId,
                invoice.splits[i].recipient,
                splitAmount
            );
        }

        // Mark invoice as paid
        invoice.paid = true;
        invoice.paidAt = block.timestamp;
        invoice.paidBy = msg.sender;

        emit InvoicePaid(_invoiceId, msg.sender, received, invoice.token);
        
        // Refund any excess MON
        if (address(this).balance > 0) {
            (bool success, ) = msg.sender.call{value: address(this).balance}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @notice Get quote for how much native MON is needed to pay invoice
     * @param _invoiceId The invoice to pay
     * @return amountIn Amount of native MON needed
     */
    function getNativeMONQuote(bytes32 _invoiceId) external view returns (uint256 amountIn) {
        require(invoiceExists[_invoiceId], "Invoice does not exist");
        Invoice storage invoice = invoices[_invoiceId];

        address[] memory path = new address[](2);
        path[0] = WMON;
        path[1] = invoice.token;

        uint256[] memory amountsIn = uniswapRouter.getAmountsIn(invoice.amount, path);
        return amountsIn[0];
    }

    /**
     * @notice Get quote for how much payment token is needed
     * @param _invoiceId The invoice to pay
     * @param _path Swap path
     * @return amountIn Amount of payment token needed
     */
    function getSwapQuote(
        bytes32 _invoiceId,
        address[] calldata _path
    ) external view returns (uint256 amountIn) {
        require(invoiceExists[_invoiceId], "Invoice does not exist");
        Invoice storage invoice = invoices[_invoiceId];

        // If same token, no swap needed
        if (_path.length < 2 || _path[0] == invoice.token) {
            return invoice.amount;
        }

        uint256[] memory amountsIn = uniswapRouter.getAmountsIn(invoice.amount, _path);
        return amountsIn[0];
    }

    /**
     * @notice Internal function to execute direct payment (no swap)
     */
    function _executeDirectPayment(bytes32 _invoiceId, Invoice storage invoice) internal {
        IERC20 token = IERC20(invoice.token);

        // Transfer from user
        token.safeTransferFrom(msg.sender, address(this), invoice.amount);

        // Distribute to recipients
        for (uint256 i = 0; i < invoice.splits.length; i++) {
            uint256 splitAmount = (invoice.amount * invoice.splits[i].basisPoints) / 10000;
            token.safeTransfer(invoice.splits[i].recipient, splitAmount);

            emit SplitDistributed(
                _invoiceId,
                invoice.splits[i].recipient,
                splitAmount
            );
        }

        invoice.paid = true;
        invoice.paidAt = block.timestamp;
        invoice.paidBy = msg.sender;

        emit InvoicePaid(_invoiceId, msg.sender, invoice.amount, invoice.token);
    }
}

