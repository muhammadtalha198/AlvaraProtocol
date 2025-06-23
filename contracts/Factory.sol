// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {UD60x18, powu, unwrap} from "@prb/math/src/UD60x18.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IBTS.sol";
import "./interfaces/IBTSPair.sol";
import "./interfaces/IUniswap.sol";
import "./interfaces/IERC20.sol";

/// @title Factory Contract for Basket Token Standard
/// @notice Handles the creation and management of Basket Token Standard contracts
/// @dev Uses BeaconProxy pattern to deploy BTS and BTSPair contracts
/// @dev Manages implementations, whitelisted contracts, and parameters for the Alvara ecosystem
contract Factory is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, IFactory {

    // ===============================================
    // Type Declarations
    // ===============================================
    
    /// @notice Structure to store platform fee configuration parameters
    /// @dev Used to manage various fees collected by the protocol
    struct PlatformFeeConfig {
        /// @notice Fee percentage applied when creating a new BTS (in PERCENT_PRECISION)
        uint16 btsCreationFee; 
        /// @notice Fee percentage applied on user contributions (in PERCENT_PRECISION)
        uint16 contributionFee; 
        /// @notice Fee percentage applied on withdrawals (in PERCENT_PRECISION)
        uint16 withdrawalFee; 
        /// @notice Address that receives all collected fees
        address feeCollector;  
    }

    // ===============================================
    // Roles
    // ===============================================

    /// @notice Role for protocol administrators with full control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    /// @notice Role for managing platform fees and related configurations
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    /// @notice Role for updating collection and contract URIs
    bytes32 public constant URI_MANAGER_ROLE = keccak256("URI_MANAGER_ROLE");
    /// @notice Role for whitelisting and managing external contracts
    bytes32 public constant WHITELIST_MANAGER_ROLE = keccak256("WHITELIST_MANAGER_ROLE");
    /// @notice Role for managing upgrades and implementation addresses
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ===============================================
    // Constants
    // ===============================================
    
    /// @notice Precision value for percentage calculations (100% = 10000)
    /// @dev Used for representing weights and percentages throughout the protocol
    uint256 public constant PERCENT_PRECISION = 10000;

    /// @notice Default platform fee in 0.5%
    uint16 public constant DEFAULT_FEE = 50; 

    // ===============================================
    // State Variables
    // ===============================================

    /// @notice The minimum LP tokens required for withdrawal (can be updated by admin)
    uint256 private _minLpWithdrawal;

    /// @notice The address of the ALVA token
    /// @dev Required in all baskets with a minimum percentage
    address public alva;

    /// @notice The address of the Uniswap Router
    /// @dev Used for swapping tokens during basket operations
    address public router;

    /// @notice The address of the Wrapped ETH token
    /// @dev Used for ETH operations and as a common denominator for swaps
    address public weth;

    /// @notice The implementation address for BTS contracts
    /// @dev Used as a blueprint for creating new BTS proxies
    address public btsImplementation;

    /// @notice The implementation address for BTSPair contracts
    /// @dev Used as a blueprint for creating new BTSPair proxies
    address public btsPairImplementation;

    /// @notice The address that receives royalties
    /// @dev Target for royalty payments from NFT marketplaces
    address public royaltyReceiver;

    /// @notice The percentage of royalties to be paid (basis points)
    /// @dev Expressed in basis points (e.g., 2000 = 20%)
    uint256 public royaltyPercentage;
    
    /// @notice The minimum percentage of ALVA required in a basket
    /// @dev Ensures every basket includes ALVA token with a minimum weight
    uint16 public minPercentALVA;

    /// @notice The minimum amount of ETH required to create a BTS
    /// @dev Sets a floor for initial liquidity to ensure meaningful baskets
    uint256 public minBTSCreationAmount;

    /// @notice The monthly management fee rate
    uint256 public monthlyFeeRate;

    /// @notice The URI for collection metadata
    /// @dev Used by NFT marketplaces to display collection information
    string public collectionUri;

    /// @notice Array of all BTS contracts created
    /// @dev Keeps track of all baskets for enumeration
    address[] public btsList;
    
    /// @notice Mapping of whitelisted contracts that can interact with BTS
    /// @dev Security feature to limit interactions to trusted contracts
    mapping(address => bool) public whitelistedContracts;

    /// @notice Current platform fee configuration
    /// @dev Stores all fee percentages and the fee collector address
    PlatformFeeConfig private platformFeeConfig;


    // ===============================================
    // Events
    // ===============================================

    /// @notice Emitted when a new BTS contract is created
    /// @param name Name of the basket token
    /// @param symbol Symbol of the basket token
    /// @param bts Address of the created BTS contract
    /// @param btsPair Address of the created BTSPair contract
    /// @param creator Address of the creator
    /// @param amount Amount of ETH used to create the basket
    /// @param _buffer Buffer percentage used for swaps
    /// @param _id Unique identifier for the basket
    /// @param description Description of the basket
    event BTSCreated(
        string name,
        string symbol,
        address bts,
        address btsPair,
        address indexed creator,
        uint256 amount,
        uint256 _buffer,
        string _id,
        string description,
        uint256 feeAmount
    );

    /// @notice Emitted when the ALVA token address is updated
    /// @param alva New ALVA token address
    event AlvaUpdated(address alva);

    /// @notice Emitted when the minimum ALVA percentage is updated
    /// @param percent New minimum percentage
    event MinAlvaPercentageUpdated(uint256 percent);

    /// @notice Emitted when the BTS implementation address is updated
    /// @param btsImplementation New implementation address
    event BTSImplementationUpdated(address indexed btsImplementation);

    /// @notice Emitted when the BTSPair implementation address is updated
    /// @param btsPairImplementation New implementation address
    event BTSPairImplementationUpdated(address indexed btsPairImplementation);


    /// @notice Emitted when the collection URI is updated
    /// @param newURI New collection URI
    event CollectionURIUpdated(string newURI);

    /// @notice Emitted when the royalty percentage is updated
    /// @param newRoyaltyPercentage New royalty percentage
    event RoyaltyUpdated(uint256 newRoyaltyPercentage);

    /// @notice Emitted when the royalty receiver is updated
    /// @param newRoyaltyReceiver New royalty receiver address
    event RoyaltyReceiverUpdated(address indexed newRoyaltyReceiver);

    /// @notice Emitted when the the platform fee updated
    /// @param btsCreationFee New BTS creation fee in precision
    /// @param contributionFee New contribution fee in  precision
    /// @param withdrawalFee New withdrawal fee in  precision
    event PlatformFeesUpdated(
        uint16 btsCreationFee, 
        uint16 contributionFee, 
        uint16 withdrawalFee        
        );
    
    /// @notice Emitted when the platform fee collector address is updated
    /// @param newFeeCollector The updated address receiving platform fees
    event FeeCollectorUpdated(address indexed newFeeCollector);

    /// @notice Emitted when the BTS creation fee is deducted from user contribution
    /// @param feeAmount The deducted fee amount in wei
    /// @param feePercent The applied fee percentage in 10000 precision
    /// @param feeCollector The address that received the deducted fee
    event BTSCreationFeeDeducted(uint256 feeAmount, uint256 feePercent, address indexed feeCollector);

    /// @notice Emitted when the minimum BTS creation amount is updated
    /// @param caller Caller who has updated the minimum creation amount
    /// @param amount is the new amount required to create a bts
    event MinBTSCreationAmountUpdated(address indexed caller, uint256 amount);

    /// @notice Emitted when a contract is whitelisted
    /// @param contractAddress Address of the contract that is whitelisted
    event ContractWhitelisted(address indexed contractAddress);

    /// @notice Emitted when a contract is removed from the whitelist
    /// @param contractAddress Address of the contract that is removed from the whitelisted
    event ContractRemovedFromWhitelist(address indexed contractAddress);

    /// @notice Emitted when the minimum LP withdrawal amount is updated
    event MinLpWithdrawalUpdated(uint256 newMinLpWithdrawal);

    // ===============================================
    // Errors
    // ===============================================

    /// @notice Error thrown when an invalid token address is provided
    error InvalidAddress();

    /// @notice Error thrown when an invalid amount is provided
    error InvalidAmount();

    /// @notice Error thrown when an invalid buffer value is specified
    /// @param provided The provided buffer value
    /// @param minAllowed The minimum allowed buffer
    /// @param maxAllowed The maximum allowed buffer
    error InvalidBuffer(uint256 provided, uint256 minAllowed, uint256 maxAllowed);
    
    /// @notice Error thrown when string parameters are empty
    /// @param paramName Name of the invalid parameter
    error EmptyStringParameter(string paramName);

    /// @notice Error thrown when a transfer fails
    error TransferFailed();

    /// @notice Error thrown when total ETH swapped exceeds the value sent
    error ExcessiveSwapAmount();

    /// @notice Error thrown when an invalid contract address is provided for whitelisting
    /// @param provided The provided address
    /// @param alreadyWhitelisted Whether the address is already whitelisted
    error InvalidWhitelistAddress(address provided, bool alreadyWhitelisted);

    /// @notice Error thrown when an invalid royalty percentage is provided
    /// @param value The provided value
    /// @param minAllowed The minimum allowed value    
    /// @param maxAllowed The maximum allowed value
    error InvalidRoyaltyPercentage(uint256 value, uint256 minAllowed, uint256 maxAllowed);

    /// @notice Error thrown when the new royalty percentage is the same as the
    /// currently set value. No update is needed in this case.
    error DuplicateRoyaltyValue();

    /// @notice Error thrown when an invalid ALVA percentage is provided
    /// @param value The provided value
    /// @param minAllowed The minimum allowed value
    /// @param maxAllowed The maximum allowed value
    error InvalidAlvaPercentage(uint256 value, uint256 minAllowed, uint256 maxAllowed);
    
    /// @notice Error thrown when the BTS creation amount is below the minimum
    /// @param provided The provided amount
    /// @param minAllowed The minimum allowed amount
    error InsufficientBTSCreationAmount(uint256 provided, uint256 minAllowed);

    /// @notice Thrown when a provided fee value or its resulting deduction exceeds valid limits
    error InvalidFee();

    /// @notice Thrown when the dealine is in past and invalid to be used for the execution
    /// @param deadline The invalid deadline value that caused the error
    error DeadlineInPast(uint256 deadline);

    /// @notice Thrown when the provided length of tokens or weights are invalid
    error InvalidTokensAndWeights();

    // ===============================================
    // Initialization
    // ===============================================

    /// @notice As Factory is a proxy contract, therefore need to restrict implementation to call initialize method 
    /// @dev Constructor will disable initializers.
    constructor() {
        _disableInitializers(); // Locks the implementation
    }

    /// @notice Initializes the Factory contract with required addresses and parameters
    /// @dev Sets up the core protocol configuration
    /// @param _alva Address of the ALVA token
    /// @param _minPercentALVA Minimum percentage of ALVA required in a basket
    /// @param _btsImplementation Implementation address for BTS contracts
    /// @param _btsPairImplementation Implementation address for BTSPair contracts
    /// @param _monthlyFeeRate Management fee
    /// @param _royaltyReceiver Address that receives royalties
    /// @param _collectionUri URI for collection metadata
    /// @param _feeCollector Fee collector address to collect platform fee    
    /// @param _defaultMarketplace Address of the default marketplace
    /// @param _routerAddress Address of the Uniswap router
    /// @param _wethAddress Address of the Wrapped ETH token
    /// @param _minBTSCreationAmount Minimum BTS creation amount
    function initialize(
        address _alva,
        uint16 _minPercentALVA,
        address _btsImplementation,
        address _btsPairImplementation,
        uint256 _monthlyFeeRate,
        address _royaltyReceiver,
        string calldata _collectionUri,
        address _feeCollector,
        address _defaultMarketplace,
        address _routerAddress,
        address _wethAddress,
        uint256 _minBTSCreationAmount
    ) external initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        __ReentrancyGuard_init();

        if (
            _alva == address(0) ||
            _btsImplementation == address(0) ||
            _btsPairImplementation == address(0) ||
            _routerAddress == address(0) ||
            _wethAddress == address(0) ||
            _royaltyReceiver == address(0) ||
            _feeCollector == address(0) ||
            _defaultMarketplace == address(0) 
        ) {
            revert InvalidAddress();
        }

        if (_minPercentALVA < 100 || _minPercentALVA > 5000) {
            revert InvalidAlvaPercentage(_minPercentALVA, 100, 5000);
        }

        if (bytes(_collectionUri).length == 0) {
            revert EmptyStringParameter("collectionUri");
        }

        alva = _alva;
        royaltyReceiver = _royaltyReceiver;
        btsImplementation = _btsImplementation;
        btsPairImplementation = _btsPairImplementation;
        minPercentALVA = _minPercentALVA;
        monthlyFeeRate = _monthlyFeeRate;
        collectionUri = _collectionUri;
        // Set default values for the fees
        platformFeeConfig = PlatformFeeConfig({
            btsCreationFee: DEFAULT_FEE,
            contributionFee: DEFAULT_FEE,
            withdrawalFee: DEFAULT_FEE,
            feeCollector: _feeCollector
        });
        royaltyPercentage = 200;
        router = _routerAddress;
        weth = _wethAddress;
        whitelistedContracts[_defaultMarketplace] = true;
        minBTSCreationAmount = _minBTSCreationAmount;
        _minLpWithdrawal = 1e11; // Set default minimum LP amount as 1e11
    }

    // ===============================================
    // External Functions
    // ===============================================

    /// @notice Returns the minimum LP withdrawal amount
    function minLpWithdrawal() external view returns (uint256) {
        return _minLpWithdrawal;
    }

    /// @notice Allows the owner to update the minimum LP withdrawal amount
    /**
     * @notice Updates the minimum LP withdrawal amount
     * @param newMin New minimum LP withdrawal amount
     * @custom:access Only callable by an account with ADMIN_ROLE
     */
    function setMinLpWithdrawal(uint256 newMin) external onlyRole(ADMIN_ROLE) {
        _minLpWithdrawal = newMin;
        emit MinLpWithdrawalUpdated(newMin);
    }

    /// @notice Creates a new Basket Token Standard contract with the specified parameters
    /// @dev Deploys a BTS and BTSPair contract, swaps ETH for tokens, and mints liquidity
    /// @dev Uses BeaconProxy pattern to create new instances from implementations
    /// @param _name Name of the basket token
    /// @param _symbol Symbol of the basket token
    /// @param _tokens Array of token addresses in the basket
    /// @param _weights Array of weights for each token
    /// @param _tokenURI URI for the basket token
    /// @param _buffer Maximum buffer percentage for swaps
    /// @param _id Unique identifier for the basket
    /// @param _description Description of the basket
    function createBTS(
        string calldata _name,
        string calldata _symbol,
        address[] calldata _tokens,
        uint256[] calldata _weights,
        string calldata _tokenURI,
        uint256 _buffer,
        string calldata _id,
        string calldata _description,
        uint256 _deadline
    ) external payable nonReentrant {
        if (msg.value < minBTSCreationAmount) revert InsufficientBTSCreationAmount(msg.value, minBTSCreationAmount);
        if (_buffer == 0 || _buffer >= 5000) {
            revert InvalidBuffer(_buffer, 1, 4999);
        }

        if(_deadline <= block.timestamp) revert DeadlineInPast(_deadline);

        if (bytes(_name).length == 0) revert EmptyStringParameter("name");
        if (bytes(_symbol).length == 0) revert EmptyStringParameter("symbol");
        if (bytes(_tokenURI).length == 0)
            revert EmptyStringParameter("tokenURI");
        if (bytes(_id).length == 0) revert EmptyStringParameter("id");
        if (_tokens.length != _weights.length || _tokens.length == 0 || _weights.length == 0) revert InvalidTokensAndWeights();

        // Check if the btsCreationFee is greater than 0 and deduct it
        uint256 creationFeeAmount = 0;
        if (platformFeeConfig.btsCreationFee > 0) {
            creationFeeAmount = (msg.value * platformFeeConfig.btsCreationFee) / PERCENT_PRECISION;
            // Ensure the deducted fee is valid
            if (creationFeeAmount > msg.value) revert InvalidFee();
            (bool success, ) = payable(platformFeeConfig.feeCollector).call{ value: creationFeeAmount }("");
            
            require(success, "Failed to deduct BTS Creation Fee");
            
            // Emit BTS creation fee deduction event
            emit BTSCreationFeeDeducted(creationFeeAmount, platformFeeConfig.btsCreationFee, platformFeeConfig.feeCollector); 
        }

        uint256 amountAfterFee = msg.value - creationFeeAmount;

        (address _bts, address _btsPair) = _initializeBTSWithPair(
            _name,
            _symbol,
            _tokens,
            _weights,
            _tokenURI,
            _id,
            _description
        );

        uint256 totalETHswapped = 0;
        uint256 tokensLength = _tokens.length;
        uint256[] memory amounts = new uint256[](tokensLength);

        for (uint256 i = 0; i < tokensLength; ) {
            uint256 _amountInMin;
            
            // For the last token, use remaining amount to avoid dust
            if (i == tokensLength - 1) {
                _amountInMin = amountAfterFee - totalETHswapped;
            } else {
                _amountInMin = (amountAfterFee * _weights[i]) / PERCENT_PRECISION;
            }

            address[] memory path = getPath(weth, _tokens[i]);

            uint256 _amountOutMin = (getAmountsOut(_amountInMin, path) *
                (PERCENT_PRECISION - _buffer)) / PERCENT_PRECISION;

            uint256 balance = IERC20(_tokens[i]).balanceOf(_btsPair);

            IUniswapV2Router(router)
                .swapExactETHForTokensSupportingFeeOnTransferTokens{
                value: _amountInMin
            }(_amountOutMin, path, _btsPair, _deadline);
            totalETHswapped += _amountInMin;

            amounts[i] = IERC20(_tokens[i]).balanceOf(_btsPair) - balance;

            unchecked {
                ++i;
            }
        }

        btsList.push(_bts);
        IBTSPair(_btsPair).mint(msg.sender, amounts);
        OwnableUpgradeable(_btsPair).transferOwnership(_bts);

        // Return back the remaining ETH 
        if (totalETHswapped > amountAfterFee) {
            revert ExcessiveSwapAmount();
        } else if (totalETHswapped < amountAfterFee) {
            (bool success, ) = payable(msg.sender).call{
                value: amountAfterFee - totalETHswapped
            }("");
            if (!success) revert TransferFailed();
        }

        emit BTSCreated(
            _name,
            _symbol,
            _bts,
            _btsPair,
            msg.sender,
            amountAfterFee,
            _buffer,
            _id,
            _description,
            creationFeeAmount
        );
    }

    /// @notice Updates the BTS implementation address
    /// @dev Used when upgrading the BTS contract logic
    /// @param _btsImplementation New implementation address
    /**
     * @notice Updates the BTS implementation address
     * @custom:access Only callable by an account with UPGRADER_ROLE
     */
    function updateBTSImplementation(
        address _btsImplementation
    ) external onlyRole(UPGRADER_ROLE) {
        if (_btsImplementation == address(0) || !AddressUpgradeable.isContract(_btsImplementation))
            revert InvalidAddress();
        btsImplementation = _btsImplementation;

        emit BTSImplementationUpdated(_btsImplementation);
    }

    /// @notice Updates the BTSPair implementation address
    /// @dev Used when upgrading the BTSPair contract logic
    /// @param _btsPairImplementation New implementation address
    /**
     * @notice Updates the BTSPair implementation address
     * @custom:access Only callable by an account with UPGRADER_ROLE
     */
    function updateBTSPairImplementation(
        address _btsPairImplementation
    ) external onlyRole(UPGRADER_ROLE) {
        if (
            _btsPairImplementation == address(0) || !AddressUpgradeable.isContract(_btsPairImplementation)) 
                revert InvalidAddress();
        btsPairImplementation = _btsPairImplementation;

        emit BTSPairImplementationUpdated(_btsPairImplementation);
    }

    /// @notice Updates the ALVA token address
    /// @dev Used when the primary ALVA token contract changes
    /// @param _alva New ALVA token address
    /**
     * @notice Updates the ALVA token address
     * @param _alva New ALVA token address
     * @custom:access Only callable by an account with UPGRADER_ROLE
     */
    function updateAlva(address _alva) external onlyRole(UPGRADER_ROLE) {
        if (_alva == address(0) || !AddressUpgradeable.isContract(_alva)) 
            revert InvalidAddress();
        alva = _alva;

        emit AlvaUpdated(_alva);
    }

    /// @notice Updates the minimum percentage of ALVA required in a basket
    /// @dev Controls the minimum ALVA token allocation in all baskets
    /// @param _minPercentALVA New minimum percentage
    /**
     * @notice Updates the minimum required ALVA percentage
     * @param _minPercentALVA New minimum percentage
     * @custom:access Only callable by an account with ADMIN_ROLE
     */
    function updateMinPercentALVA(uint16 _minPercentALVA) external onlyRole(ADMIN_ROLE) {
        if (_minPercentALVA < 100 || _minPercentALVA > 5000) {
            revert InvalidAlvaPercentage(_minPercentALVA, 100, 5000);
        }
        minPercentALVA = _minPercentALVA;

        emit MinAlvaPercentageUpdated(_minPercentALVA);
    }

    /// @notice Updates the collection URI
    /// @dev Sets the collection metadata URI for NFT marketplaces
    /// @param _collectionURI New collection URI
    /**
     * @notice Updates the collection URI
     * @param _collectionURI New collection URI
     * @custom:access Only callable by an account with URI_MANAGER_ROLE
     */
    function updateCollectionURI(string calldata _collectionURI) external onlyRole(URI_MANAGER_ROLE) {
        if (bytes(_collectionURI).length == 0) revert EmptyStringParameter("URI");
        collectionUri = _collectionURI;

        emit CollectionURIUpdated(_collectionURI);
    }

    /// @notice Updates the royalty percentage
    /// @dev Sets the percentage of sales that go to the royalty receiver
    /// @param _royaltyPercentage New royalty percentage (in basis points)
    /**
     * @notice Updates the royalty percentage
     * @custom:access Only callable by an account with FEE_MANAGER_ROLE
     */
    function updateRoyaltyPercentage(
        uint256 _royaltyPercentage
    ) external onlyRole(FEE_MANAGER_ROLE) {
        if (_royaltyPercentage == 0 || _royaltyPercentage > 300) {
            revert InvalidRoyaltyPercentage(_royaltyPercentage, 1, 300);
        }

        if (_royaltyPercentage == royaltyPercentage) {
            revert DuplicateRoyaltyValue();
        }

        royaltyPercentage = _royaltyPercentage;

        emit RoyaltyUpdated(_royaltyPercentage);
    }

    /// @notice Updates the royalty receiver address
    /// @dev Sets the address that receives royalties from NFT sales
    /// @param _royaltyReceiver  New royalty receiver address
    /**
     * @notice Updates the royalty receiver address
     * @custom:access Only callable by an account with FEE_MANAGER_ROLE
     */
    function updateRoyaltyReceiver(
        address _royaltyReceiver 
    ) external onlyRole(FEE_MANAGER_ROLE) {
        if (_royaltyReceiver == address(0) || _royaltyReceiver == royaltyReceiver) revert InvalidAddress();
        royaltyReceiver = _royaltyReceiver;

        emit RoyaltyReceiverUpdated(_royaltyReceiver);
    }

    /// @notice Updates the minimum BTS creation amount
    /// @dev Sets a new minimum amount for BTS creation
    /// @param _minBTSCreationAmount New minimum BTS creation amount (must be greater than zero)
    /**
     * @notice Updates the minimum BTS creation amount
     * @custom:access Only callable by an account with ADMIN_ROLE
     */
    function updateMinBTSCreationAmount(
        uint256 _minBTSCreationAmount
    ) external onlyRole(ADMIN_ROLE) {
        if (_minBTSCreationAmount == 0 || _minBTSCreationAmount == minBTSCreationAmount) revert InvalidAmount();
        minBTSCreationAmount = _minBTSCreationAmount;
        emit MinBTSCreationAmountUpdated(msg.sender, _minBTSCreationAmount);
    }

    /// @notice Adds a contract to the whitelist
    /// @dev Allows the specified contract to interact with basket tokens
    /// @param contractAddr Address of the contract to whitelist
    /**
     * @notice Adds a contract to the whitelist
     * @param contractAddr Address to whitelist
     * @custom:access Only callable by an account with WHITELIST_MANAGER_ROLE
     */
    function addWhitelistedContract(address contractAddr) external onlyRole(WHITELIST_MANAGER_ROLE) {
        if (
            contractAddr == address(0) || 
            whitelistedContracts[contractAddr] || 
            !AddressUpgradeable.isContract(contractAddr)
        ) {
                revert InvalidWhitelistAddress(
                contractAddr,
                whitelistedContracts[contractAddr]
            );
        }
        whitelistedContracts[contractAddr] = true;
        emit ContractWhitelisted(contractAddr);
    }

    /// @notice Dewhitelist the contract address
    /// @dev Revokes permission for the contract to interact with basket tokens
    /// @param contractAddr Address of the contract be dewhitelisted
    /**
     * @notice Removes a contract from the whitelist
     * @custom:access Only callable by an account with WHITELIST_MANAGER_ROLE
     */
    function dewhitelistContract(
        address contractAddr
    ) external onlyRole(WHITELIST_MANAGER_ROLE) {
        if (!whitelistedContracts[contractAddr]) {
            revert InvalidWhitelistAddress(
                contractAddr,
                whitelistedContracts[contractAddr]
            );
        }
        whitelistedContracts[contractAddr] = false;
        emit ContractRemovedFromWhitelist(contractAddr);
    }

    /// @notice Updates the platform fee configuration for BTS creation, contribution, and withdrawal
    /// @param _btsCreationFee The new fee percentage for BTS creation (in 10000 precision)
    /// @param _contributionFee The new fee percentage for contributing ETH (in 10000 precision)
    /// @param _withdrawalFee The new fee percentage for withdrawals (in 10000 precision)
    /// @dev Reverts if any fee exceeds the precision limit
    /**
     * @notice Sets the platform fee configuration
     * @custom:access Only callable by an account with FEE_MANAGER_ROLE
     */
    function setPlatformFeeConfig(
        uint16 _btsCreationFee,
        uint16 _contributionFee,
        uint16 _withdrawalFee
    ) external onlyRole(FEE_MANAGER_ROLE) {
        // Validate that the fee values are within the correct range (0 - 0.5%)
        if (_btsCreationFee > DEFAULT_FEE || _contributionFee > DEFAULT_FEE || _withdrawalFee > DEFAULT_FEE)  revert InvalidFee();
        
        // Update the platform fee configuration
        platformFeeConfig = PlatformFeeConfig({
            btsCreationFee: _btsCreationFee,
            contributionFee: _contributionFee,
            withdrawalFee: _withdrawalFee,
            feeCollector: platformFeeConfig.feeCollector // keep feeCollector unchanged
        });

        // Emit event for fee update
        emit PlatformFeesUpdated(_btsCreationFee, _contributionFee, _withdrawalFee);
    }

    /// @notice Updates the fee collector address used to collect platform fees
    /// @param _feeCollector The new address to receive the platform fees
    /// @dev Reverts if the new address is zero or the same as the current one
    /**
     * @notice Sets the fee collector address
     * @param _feeCollector Address to collect fees
     * @custom:access Only callable by an account with FEE_MANAGER_ROLE
     */
    function setFeeCollector(address _feeCollector) external onlyRole(FEE_MANAGER_ROLE) {
        // Validate the feeCollector address
        if (_feeCollector == address(0) || _feeCollector == platformFeeConfig.feeCollector) revert InvalidAddress();

        // Update the fee collector address
        platformFeeConfig.feeCollector = _feeCollector;

        // Emit event for fee collector update
        emit FeeCollectorUpdated(_feeCollector);
    }
    /// @notice Gets the total number of BTS contracts created
    /// @dev Useful for enumeration and statistics
    /// @return Total number of BTS contracts in the system
    function totalBTS() external view returns (uint) {
        return btsList.length;
    }

    /// @notice Gets a BTS contract at a specific index
    /// @dev Enables enumeration of all baskets in the system
    /// @param index Index in the btsList array
    /// @return Address of the BTS contract
    function getBTSAtIndex(uint256 index) external view returns (address) {
        require(index < btsList.length, "Index out of bounds");
        return btsList[index];
    }

    /// @notice Calculates the management fee based on LP supply and timeframe
    /// @dev Uses compound interest formula with PRBMath for precise calculations
    /// @dev Formula: LP_fee = LP_supply * (1 - (1 - fee_rate)^months) / (1 - (1 - (1 - fee_rate)^months))
    /// @param months Number of months to calculate fee for
    /// @param lpSupply Total supply of LP tokens in the basket
    /// @return Amount of LP tokens to be claimed as management fee
    function calMgmtFee(uint256 months, uint256 lpSupply) external view returns (uint256) {

        // Compute (1 - FeeRate)
        uint256 oneMinusFeeRate = 1e18 - monthlyFeeRate;

        // Compute (1 - FeeRate) ^ months using PRBMath's pow
        uint256 powerValue = unwrap(powu(UD60x18.wrap(oneMinusFeeRate), months));

        // Compute numerator: (1 - powerValue) * LP_Supply
        uint256 numerator = (1e18 - powerValue) * lpSupply;

        // Final result: FeeAmount = numerator / powerValue
        uint256 lpFeeAmount  = numerator / powerValue;

        return lpFeeAmount;
    }

    /// @notice Returns the contract URI for metadata
    /// @dev Used by NFT marketplaces to display collection information
    /// @return The collection URI string
    function getContractURI() external view returns (string memory) {
        return collectionUri;
    }

    /// @notice Checks if a contract is whitelisted
    /// @dev Used by BTS contracts to verify if interaction is permitted
    /// @param contractAddr Address of the contract to check
    /// @return True if the contract is whitelisted, false otherwise
    function isWhitelistedContract(
        address contractAddr
    ) external view returns (bool) {
        return whitelistedContracts[contractAddr];
    }

    /// @notice Retrieves the current platform fee configuration
    /// @dev Returns all fee percentages and the fee collector address
    /// @return btsCreationFee Fee percentage for BTS creation
    /// @return contributionFee Fee percentage for contributions
    /// @return withdrawalFee Fee percentage for withdrawals
    /// @return feeCollector Address that receives all collected fees
    function getPlatformFeeConfig() external view returns (uint16, uint16, uint16, address)
    {
        return (
            platformFeeConfig.btsCreationFee,
            platformFeeConfig.contributionFee,
            platformFeeConfig.withdrawalFee,
            platformFeeConfig.feeCollector
        );
    }


    // ===============================================
    // Internal Functions
    // ===============================================

    /// @notice Initializes a new BTS contract with its associated BTSPair
    /// @dev Creates both contracts using BeaconProxy pattern and links them together
    /// @param _name Name of the basket token
    /// @param _symbol Symbol of the basket token
    /// @param _tokens Array of token addresses in the basket
    /// @param _weights Array of weights for each token
    /// @param _tokenURI URI for the basket token metadata
    /// @param _id Unique identifier for the basket
    /// @param _description Human-readable description of the basket
    /// @return _bts Address of the created BTS contract
    /// @return _btsPair Address of the created BTSPair contract
    function _initializeBTSWithPair(
        string calldata _name,
        string calldata _symbol,
        address[] memory _tokens,
        uint256[] calldata _weights,
        string calldata _tokenURI,
        string calldata _id,
        string memory _description
    ) internal returns (address _bts, address _btsPair) {
        BeaconProxy btsPair = new BeaconProxy(
            btsPairImplementation,
            abi.encodeWithSelector(
                IBTSPair.initialize.selector,
                address(this),
                _symbol,
                _tokens
            )
        );

        _btsPair = address(btsPair);

        BeaconProxy bts = new BeaconProxy(
            btsImplementation,
            abi.encodeWithSelector(
                IBTS.initialize.selector,
                _name,
                _symbol,
                msg.sender,
                address(this),
                _tokens,
                _weights,
                _btsPair,
                _tokenURI,
                _id,
                _description
            )
        );

        _bts = address(bts);
    }

    // ===============================================
    // Public View/Pure Functions
    // ===============================================

    /// @notice Gets the expected output amount for a swap
    /// @dev Wrapper for Uniswap router's getAmountsOut function
    /// @param _amount Input amount
    /// @param _path Path for the swap
    /// @return Expected output amount
    function getAmountsOut(
        uint256 _amount,
        address[] memory _path
    ) public view returns (uint) {
        return IUniswapV2Router(router).getAmountsOut(_amount, _path)[_path.length - 1];
    }

    /// @notice Creates a path array for token swaps
    /// @dev Helper function for Uniswap router interactions
    /// @param _tokenA First token in the path
    /// @param _tokenB Second token in the path
    /// @return Path array containing both token addresses
    function getPath(
        address _tokenA,
        address _tokenB
    ) public pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = _tokenA;
        path[1] = _tokenB;

        return path;
    }

}
