// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title RemittanceEscrow
 * @notice Escrow contract for USDC remittances to Latin America
 * @dev Holds USDC until operator confirms off-chain delivery
 */
contract RemittanceEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- State Variables ---
    
    IERC20 public immutable usdc;
    
    enum Status { 
        Created,    // Remittance created, awaiting funding
        Funded,     // USDC deposited in escrow
        Completed,  // Off-chain delivery confirmed, funds released
        Refunded    // Funds returned to sender
    }
    
    struct Remittance {
        address sender;
        string recipientId;         // External recipient identifier (e.g., national ID)
        uint256 amountUSDC;         // Amount in USDC (6 decimals)
        uint256 targetAmountCOP;    // Expected COP amount for recipient
        uint256 exchangeRate;       // Rate at creation (COP per USD, 4 decimals)
        Status status;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 completedAt;
    }
    
    mapping(bytes32 => Remittance) public remittances;
    mapping(address => bytes32[]) public userRemittances;
    
    uint256 public remittanceCount;
    uint256 public constant REFUND_TIMEOUT = 7 days;
    
    // --- Events ---
    
    event RemittanceCreated(
        bytes32 indexed remittanceId,
        address indexed sender,
        string recipientId,
        uint256 amountUSDC,
        uint256 targetAmountCOP,
        uint256 exchangeRate
    );
    
    event RemittanceFunded(
        bytes32 indexed remittanceId,
        uint256 timestamp
    );
    
    event RemittanceCompleted(
        bytes32 indexed remittanceId,
        uint256 timestamp
    );
    
    event RemittanceRefunded(
        bytes32 indexed remittanceId,
        uint256 timestamp
    );

    // --- Constructor ---
    
    constructor(address _usdcAddress) Ownable(msg.sender) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        usdc = IERC20(_usdcAddress);
    }

    // --- External Functions ---
    
    /**
     * @notice Create a new remittance
     * @param recipientId External identifier for the recipient
     * @param amountUSDC Amount in USDC (6 decimals)
     * @param exchangeRate COP per USD rate (4 decimals, e.g., 41500000 = 4150.0000)
     * @return remittanceId Unique identifier for the remittance
     */
    function createRemittance(
        string calldata recipientId,
        uint256 amountUSDC,
        uint256 exchangeRate
    ) external returns (bytes32 remittanceId) {
        require(bytes(recipientId).length > 0, "Invalid recipient ID");
        require(amountUSDC > 0, "Amount must be greater than 0");
        require(exchangeRate > 0, "Invalid exchange rate");
        
        remittanceCount++;
        remittanceId = keccak256(
            abi.encodePacked(
                msg.sender,
                recipientId,
                amountUSDC,
                block.timestamp,
                remittanceCount
            )
        );
        
        // Calculate target COP amount (USDC has 6 decimals, rate has 4 decimals)
        // Result: (amountUSDC * exchangeRate) / 10^4 = COP with 6 decimals
        // Then we adjust to 2 decimals for COP: / 10^4
        uint256 targetAmountCOP = (amountUSDC * exchangeRate) / 1e4;
        
        remittances[remittanceId] = Remittance({
            sender: msg.sender,
            recipientId: recipientId,
            amountUSDC: amountUSDC,
            targetAmountCOP: targetAmountCOP,
            exchangeRate: exchangeRate,
            status: Status.Created,
            createdAt: block.timestamp,
            fundedAt: 0,
            completedAt: 0
        });
        
        userRemittances[msg.sender].push(remittanceId);
        
        emit RemittanceCreated(
            remittanceId,
            msg.sender,
            recipientId,
            amountUSDC,
            targetAmountCOP,
            exchangeRate
        );
        
        return remittanceId;
    }
    
    /**
     * @notice Deposit USDC to fund a remittance
     * @dev Requires prior approval of USDC transfer
     * @param remittanceId The remittance to fund
     */
    function deposit(bytes32 remittanceId) external nonReentrant {
        Remittance storage rem = remittances[remittanceId];
        
        require(rem.sender == msg.sender, "Not the sender");
        require(rem.status == Status.Created, "Invalid status");
        
        rem.status = Status.Funded;
        rem.fundedAt = block.timestamp;
        
        usdc.safeTransferFrom(msg.sender, address(this), rem.amountUSDC);
        
        emit RemittanceFunded(remittanceId, block.timestamp);
    }
    
    /**
     * @notice Release funds after confirming off-chain delivery
     * @dev Only callable by contract owner (operator)
     * @param remittanceId The remittance to complete
     */
    function release(bytes32 remittanceId) external onlyOwner nonReentrant {
        Remittance storage rem = remittances[remittanceId];
        
        require(rem.status == Status.Funded, "Invalid status");
        
        rem.status = Status.Completed;
        rem.completedAt = block.timestamp;
        
        // In production, funds would go to a liquidity pool or treasury
        // For PoC, funds stay in contract (simulating settlement)
        
        emit RemittanceCompleted(remittanceId, block.timestamp);
    }
    
    /**
     * @notice Refund USDC to sender
     * @dev Callable by sender after timeout, or by owner anytime
     * @param remittanceId The remittance to refund
     */
    function refund(bytes32 remittanceId) external nonReentrant {
        Remittance storage rem = remittances[remittanceId];
        
        require(rem.status == Status.Funded, "Invalid status");
        
        bool isOwner = msg.sender == owner();
        bool isSenderAfterTimeout = (
            msg.sender == rem.sender && 
            block.timestamp >= rem.fundedAt + REFUND_TIMEOUT
        );
        
        require(isOwner || isSenderAfterTimeout, "Not authorized");
        
        rem.status = Status.Refunded;
        rem.completedAt = block.timestamp;
        
        usdc.safeTransfer(rem.sender, rem.amountUSDC);
        
        emit RemittanceRefunded(remittanceId, block.timestamp);
    }

    // --- View Functions ---
    
    /**
     * @notice Get remittance details
     */
    function getRemittance(bytes32 remittanceId) 
        external 
        view 
        returns (Remittance memory) 
    {
        return remittances[remittanceId];
    }
    
    /**
     * @notice Get all remittance IDs for a user
     */
    function getUserRemittances(address user) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return userRemittances[user];
    }
    
    /**
     * @notice Get contract's USDC balance
     */
    function getContractBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
