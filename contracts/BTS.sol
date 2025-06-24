// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol"; 
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "./interfaces/IBTSPair.sol";
import "./interfaces/IFactory.sol";
import "./interfaces/IUniswap.sol";
import "./interfaces/IWETH.sol";
import "./interfaces/IBTS.sol";


contract BasketTokenStandard is 
    ERC721URIStorageUpgradeable,
    IERC2981Upgradeable,
    ReentrancyGuardUpgradeable,
    IBTS
{
    using SafeERC20Upgradeable for IERC20Upgradeable;

    
    struct TokenDetails {
        address[] tokens;
        uint256[] weights;
    }

   
    bytes4 private constant INTERFACE_ID_ERC2981 = 0x2a55205a;
    uint256 public constant PERCENT_PRECISION = 10000;
    
    address public btsPair;
    address public factory;
    string public id;
    string public description;

    mapping(bytes4 => bool) private _supportedInterfaces;

    TokenDetails private _tokenDetails;

    modifier validateMinLpWithdrawal(uint256 amount) {
        uint256 min = _factory().minLpWithdrawal();
        if (amount < min) revert InvalidWithdrawalAmount();
        _;
    }

    modifier checkLength(uint256 lengthOne, uint256 lengthTwo) {
        if (lengthOne != lengthTwo || lengthOne == 0 || lengthTwo == 0)
            revert InvalidLength();
        _;
    }


    modifier onlyOwner() {
        if (getOwner() != msg.sender) revert InvalidOwner();
        _;
    }

    modifier onlyWhitelistedContract(address target) {
        if (isContractAddress(target)) {
            if (!_factory().isWhitelistedContract(target))
                revert ContractNotWhitelisted();
        }
        _;
    }

    event ContributedToBTS(address bts, address indexed sender, uint256 amount);
    event WithdrawnFromBTS(
        address bts,
        address indexed sender,
        address[] tokens,
        uint256[] amounts
    );
    event WithdrawnETHFromBTS(
        address bts,
        address indexed sender,
        uint256 amount
    );
    event BTSRebalanced(
        address bts,
        address[] oldtokens,
        uint256[] oldWeights,
        address[] newTokens,
        uint256[] newWeights
    );
    event PlatformFeeDeducted(
        uint256 feeAmount,
        uint256 feePercent,
        address indexed feeCollector,
        string action
    );
    event FeeClaimed(
        address indexed bts,
        address indexed manager,
        uint256 lpAmount,
        uint256 ethAmount
    );
    error InvalidLength();
    error InvalidToken();
    error InvalidWeight();
    error InvalidOwner();
    error InvalidBuffer(
        uint256 provided,
        uint256 minRequired,
        uint256 maxAllowed
    );
    error DuplicateToken();
    error ContractNotWhitelisted();
    error ZeroContributionAmount();
    error InvalidEmergencyParams();
    error NoAlvaTokenIncluded();
    error InsufficientAlvaPercentage(uint256 provided, uint256 required);
    error ZeroTokenWeight();
    error InvalidInterfaceId();
    error InvalidWithdrawalAmount();
    error DeadlineInPast(uint256 deadline);
    error InvalidContractAddress(address target);
    error TokenIndexOutOfBounds(uint256 index, uint256 length);
    error UnauthorizedSender(address sender);


    
    function initialize(
        InitParams calldata params
    ) external checkLength(params._tokens.length, params._weights.length) initializer {
        __ERC721_init(params._name, params._symbol);
        _registerInterface(INTERFACE_ID_ERC2981);
        __ReentrancyGuard_init();

        factory = params._factoryAddress;
        id = params._id;
        _checkValidTokensAndWeights(params._tokens,params._weights);

        btsPair = params._btsPair;

        _tokenDetails.tokens = params._tokens;
        _tokenDetails.weights = params._weights;

        description = params._description;

        _safeMint(params._owner, 0);
        _setTokenURI(0, params._tokenURI);
    }

    receive() external payable {
        if (!isContractAddress(msg.sender))
            revert UnauthorizedSender(msg.sender);
    }


    function contribute(uint256 _buffer, uint256 _deadline) external payable nonReentrant {
        
        if (_buffer == 0 || _buffer >= 5000) {
            revert InvalidBuffer(_buffer, 1, 4999);
        }
        
        if (msg.value == 0) revert ZeroContributionAmount();
        if (_deadline <= block.timestamp) revert DeadlineInPast(_deadline);

        IFactory factoryInstance = _factory();

        (, uint256 contributionFee, , address feeCollector) = factoryInstance.getPlatformFeeConfig();

        (, uint256 amountAfterFee) = _handleFee(msg.value, contributionFee, feeCollector);

        uint256[] memory amounts = _swapETHToTokens(factoryInstance, amountAfterFee, _buffer, _deadline);

        IBTSPair(btsPair).mint(msg.sender, amounts);

        emit ContributedToBTS(address(this), msg.sender, msg.value);
    }

    function _handleFee(uint256 msgValue, uint256 contributionFee, address feeCollector) private
    returns (uint256 feeAmount, uint256 amountAfterFee) {

        if (contributionFee > 0) {
            feeAmount = (msgValue * contributionFee) / PERCENT_PRECISION;
            (bool success, ) = payable(feeCollector).call{value: feeAmount}("");
            require(success, "Failed to deduct Contribution Fee");
            emit PlatformFeeDeducted(feeAmount, contributionFee, feeCollector, "contribute");
        }

        amountAfterFee = msgValue - feeAmount;
    }


    function _swapETHToTokens(
        IFactory factoryInstance,
        uint256 amountAfterFee,
        uint256 _buffer,
        uint256 _deadline
    ) private returns (uint256[] memory amounts) {
        uint256 tokensLength = _tokenDetails.tokens.length;
        amounts = new uint256[](tokensLength);
        uint256 totalAllocated;

        for (uint256 i = 0; i < tokensLength; ) {
            uint256 amountInMin = _calculateAmountInMin(i, amountAfterFee, totalAllocated);
            if (i != tokensLength - 1) {
                totalAllocated += amountInMin;
            }

            amounts[i] = _swapSingleToken(
                factoryInstance,
                i,
                amountInMin,
                _buffer,
                _deadline
            );

            unchecked {
                ++i;
            }
        }
    }


    function _calculateAmountInMin(
        uint256 index,
        uint256 amountAfterFee,
        uint256 totalAllocated
    ) private view returns (uint256) {
        if (index == _tokenDetails.tokens.length - 1) {
            return amountAfterFee - totalAllocated;
        }
        uint256 weight = _tokenDetails.weights[index];
        return (amountAfterFee * weight) / PERCENT_PRECISION;
    }


    function _swapSingleToken(
        IFactory factoryInstance,
        uint256 index,
        uint256 amountInMin,
        uint256 _buffer,
        uint256 _deadline
    ) private returns (uint256 amountOut) {
        address token = _tokenDetails.tokens[index];
        address wethAddress = factoryInstance.weth();
        address routerAddress = factoryInstance.router();

        address[] memory path = factoryInstance.getPath(wethAddress, token);

        uint256 amountOutMin = _getAmountOutMin(factoryInstance, amountInMin, path, _buffer);
        uint256 balanceBefore = IERC20Upgradeable(token).balanceOf(btsPair);

        IUniswapV2Router(routerAddress)
            .swapExactETHForTokensSupportingFeeOnTransferTokens{value: amountInMin}(
                amountOutMin,
                path,
                btsPair,
                _deadline
            );

        amountOut = IERC20Upgradeable(token).balanceOf(btsPair) - balanceBefore;
    }

    function _getAmountOutMin(
        IFactory factoryInstance,
        uint256 amountIn,
        address[] memory path,
        uint256 buffer
    ) private view returns (uint256) {
        uint256 rawOut = factoryInstance.getAmountsOut(amountIn, path);
        return (rawOut * (PERCENT_PRECISION - buffer)) / PERCENT_PRECISION;
    }

    function withdraw(
        uint256 _liquidity,
        uint256 _buffer,
        uint256 _deadline
    ) external nonReentrant validateMinLpWithdrawal(_liquidity) {
        if (_buffer == 0 || _buffer >= 5000) {
            revert InvalidBuffer(_buffer, 1, 4999);
        }

        // Get fee configuration from Factory
        IFactory factoryInstance = _factory(); // ✅ cache factory instance
        (, , uint256 withdrawalFee, address feeCollector) = factoryInstance
            .getPlatformFeeConfig();

        uint256 feeLiquidity = 0;

        // Deduct withdrawal fee
        if (withdrawalFee > 0) {
            feeLiquidity = (_liquidity * withdrawalFee) / PERCENT_PRECISION;

            // Withdraw fee portion to this contract first
            uint256[] memory feeAmounts = _withdraw(
                feeLiquidity,
                address(this)
            );
            // Convert tokens to WETH and send to user
            uint256 ethAmount = _tokensToEth(
                factoryInstance,
                feeAmounts,
                payable(feeCollector),
                _buffer,
                _deadline
            );
            emit PlatformFeeDeducted(
                ethAmount,
                withdrawalFee,
                feeCollector,
                "withdrawTokens"
            );
        }

        // Process user's portion
        uint256 userLiquidity = _liquidity - feeLiquidity;

        // Withdraw Tokens
        uint256[] memory userAmounts = _withdraw(userLiquidity, msg.sender);

        // Emit Withdrawal Event
        emit WithdrawnFromBTS(
            address(this),
            msg.sender,
            _tokenDetails.tokens,
            userAmounts
        );
    }

    function _tokensToEth(
        IFactory factoryInstance,
        uint256[] memory _amounts,
        address payable _receiver,
        uint256 _buffer,
        uint256 _deadline
    ) private returns (uint256 totalETH) {
        if (_deadline <= block.timestamp) revert DeadlineInPast(_deadline);

        address wethAddress = factoryInstance.weth(); // ✅ cache
        address routerAddress = factoryInstance.router(); // ✅ cache
        uint256 totalWETH = 0;

        // Step 1: Convert all tokens to WETH (collected in this contract)
        for (uint256 i = 0; i < _amounts.length; ) {
            if (_amounts[i] > 0) {
                if (_tokenDetails.tokens[i] == wethAddress) {
                    totalWETH += _amounts[i];
                } else {
                    uint256 wethAmount = _swapTokensForTokens(
                        _tokenDetails.tokens[i],
                        wethAddress,
                        routerAddress,
                        _amounts[i],
                        address(this), // Send to this contract instead of receiver
                        _buffer,
                        _deadline
                    );
                    totalWETH += wethAmount;
                }
            }
            unchecked {
                ++i;
            }
        }

        // Step 2: Convert WETH to ETH and send to receiver
        if (totalWETH > 0) {
            IWETH(wethAddress).withdraw(totalWETH);
            (bool success, ) = _receiver.call{value: totalWETH}("");
            require(
                success,
                "Failed to unwrap and transfer WETH to the receiver"
            );
            totalETH = totalWETH;
        }

        return totalETH;
    }

    function withdrawETH(
        uint256 _liquidity,
        uint256 _buffer,
        uint256 _deadline
    ) external nonReentrant validateMinLpWithdrawal(_liquidity) {
        if (_buffer == 0 || _buffer >= 5000) {
            revert InvalidBuffer(_buffer, 1, 4999);
        }

        // Get fee configuration from Factory
        IFactory factoryInstance = _factory(); // ✅ cache factory instance
        (, , uint256 withdrawalFee, address feeCollector) = factoryInstance
            .getPlatformFeeConfig();

        uint256 feeLiquidity = 0;
        uint256 userLiquidity = _liquidity;
        uint256 feeWethAmount = 0;

        // Deduct withdrawal fee
        if (withdrawalFee > 0) {
            feeLiquidity = (_liquidity * withdrawalFee) / PERCENT_PRECISION;
            userLiquidity = _liquidity - feeLiquidity;

            // Withdraw fee portion to this contract first
            uint256[] memory feeAmounts = _withdraw(
                feeLiquidity,
                address(this)
            );

            // Convert fee tokens to WETH and send to fee collector
            feeWethAmount = _tokensToEth(
                factoryInstance,
                feeAmounts,
                payable(feeCollector),
                _buffer,
                _deadline
            );
            emit PlatformFeeDeducted(
                feeWethAmount,
                withdrawalFee,
                feeCollector,
                "withdrawETH"
            );
        }

        // Process user's portion
        uint256[] memory userAmounts = _withdraw(userLiquidity, address(this));

        // Convert user tokens to WETH and send to user
        uint256 ethAmount = _tokensToEth(
            factoryInstance,
            userAmounts,
            payable(msg.sender),
            _buffer,
            _deadline
        );

        emit WithdrawnETHFromBTS(address(this), msg.sender, ethAmount);
    }

    /// @notice Allows the owner to rebalance the basket with new tokens and weights
    /// @dev Changes the basket composition by selling current tokens and buying new ones
    /// @param _newTokens Array of new token addresses
    /// @param _newWeights Array of new token weights
    /// @param _buffer Maximum allowed buffer percentage
    /// @param _deadline Deadline for the transaction
    function rebalance(
        address[] calldata _newTokens,
        uint256[] calldata _newWeights,
        uint256 _buffer,
        uint256 _deadline
    ) external onlyOwner {
        if (_buffer == 0 || _buffer >= 5000) {
            revert InvalidBuffer(_buffer, 1, 4999);
        }
        _rebalance(_newTokens, _newWeights, _buffer, false, _deadline);
    }

    function emergencyStable(
        address[] calldata _newTokens,
        uint256[] calldata _newWeights,
        uint256 _buffer,
        uint256 _deadline
    ) external onlyOwner {
        if (_buffer == 0 || _buffer >= 5000) {
            revert InvalidBuffer(_buffer, 1, 4999);
        }
        _rebalance(_newTokens, _newWeights, _buffer, true, _deadline);
    }


    function claimFee(
        uint256 amount,
        uint256 _buffer,
        uint256 _deadline
    ) external onlyOwner {
        if (_buffer == 0 || _buffer >= 5000) {
            revert InvalidBuffer(_buffer, 1, 4999);
        }

        IFactory factoryInstance = _factory(); // ✅ cache factory instance

        IBTSPair(btsPair).distMgmtFee();
        IERC20Upgradeable(btsPair).transfer(btsPair, amount);
        uint256[] memory _amounts = IBTSPair(btsPair).burn(address(this));

        uint256 ethBought = _tokensToEth(
            factoryInstance,
            _amounts,
            payable(getOwner()),
            _buffer,
            _deadline
        );

        emit FeeClaimed(address(this), getOwner(), amount, ethBought);
    }


    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
        override(ERC721Upgradeable,IERC721 )
        onlyWhitelistedContract(to)
    {
        super.transferFrom(from, to, tokenId);
    }


    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
        override(ERC721Upgradeable, IERC721)
        onlyWhitelistedContract(to)
    {
        super.safeTransferFrom(from, to, tokenId);
    }


    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    )
        public
        override(ERC721Upgradeable, IERC721)
        onlyWhitelistedContract(to)
    {
        super.safeTransferFrom(from, to, tokenId, data);
    }


    function approve(address to, uint256 tokenId)
        public
        override(ERC721Upgradeable, IERC721)
        onlyWhitelistedContract(to)
    {
        super.approve(to, tokenId);
    }


    function setApprovalForAll(address operator, bool approved)
        public
        override(ERC721Upgradeable, IERC721)        
    {
        if(approved) {
            if (isContractAddress(operator) && !_factory().isWhitelistedContract(operator)) {
                revert ContractNotWhitelisted();
            }
        }
        
        super.setApprovalForAll(operator, approved);
    }


    function _checkValidTokensAndWeights(
        address[] memory _tokens,
        uint256[] memory _weights
    ) private view {
        uint256 _totalWeight;
        bool isAlvaPresent = false;
        address alvaAddress = _factory().alva();

        for (uint256 i = 0; i < _tokens.length; ) {
            if (!isContractAddress(_tokens[i]))
                revert InvalidContractAddress(_tokens[i]);

            if (
                !_checkForDuplicateAddress(_tokens, _tokens[i], i + 1) &&
                _weights[i] != 0
            ) {
                if (_tokens[i] == alvaAddress) {
                    isAlvaPresent = true;
                    uint256 minPercentALVA = _factory().minPercentALVA();
                    if (_weights[i] < minPercentALVA) {
                        revert InsufficientAlvaPercentage(
                            _weights[i],
                            minPercentALVA
                        );
                    }
                }

                _totalWeight += _weights[i];
            } else {
                if (_weights[i] == 0) {
                    revert ZeroTokenWeight();
                } else {
                    revert InvalidToken();
                }
            }

            unchecked {
                ++i;
            }
        }

        if (!isAlvaPresent) revert NoAlvaTokenIncluded();
        if (_totalWeight != PERCENT_PRECISION) revert InvalidWeight();
    }


    function _withdraw(uint256 _liquidity, address _to)
        private
        returns (uint256[] memory amounts)
    {
        if (_liquidity == 0) revert InvalidWithdrawalAmount();

        IERC20Upgradeable(btsPair).transferFrom(
            msg.sender,
            btsPair,
            _liquidity
        );
        amounts = IBTSPair(btsPair).burn(_to);
    }


    function _rebalance(
        address[] memory _newTokens,
        uint256[] memory _newWeights,
        uint256 _buffer,
        bool _isEmergencyStable,
        uint256 _deadline
    ) private checkLength(_newTokens.length, _newWeights.length) {
        if (_isEmergencyStable && _newTokens.length != 2) {
            revert InvalidEmergencyParams();
        }
        if (_deadline <= block.timestamp) revert DeadlineInPast(_deadline);

        _checkValidTokensAndWeights(_newTokens, _newWeights);

        IBTSPair(btsPair).setReentrancyGuardStatus(true);
        IBTSPair(btsPair).transferTokensToOwner();

        uint256 wethAmount = _withdrawAllTokensToWETH(_buffer, _deadline);
        _distributeWETHIntoNewTokens(_newTokens, _newWeights, wethAmount, _buffer, _deadline);

        emit BTSRebalanced(
            address(this),
            _tokenDetails.tokens,
            _tokenDetails.weights,
            _newTokens,
            _newWeights
        );

        IBTSPair(btsPair).updateTokens(_newTokens);
        _tokenDetails.tokens = _newTokens;
        _tokenDetails.weights = _newWeights;
        IBTSPair(btsPair).setReentrancyGuardStatus(false);
    }

    function _withdrawAllTokensToWETH(
        uint256 _buffer,
        uint256 _deadline
    ) private returns (uint256 totalWETH) {
        IFactory factory1 = _factory();
        address weth = factory1.weth();
        address router = factory1.router();

        uint256 tokensLength = _tokenDetails.tokens.length;

        for (uint256 i = 0; i < tokensLength; ) {
            address token = _tokenDetails.tokens[i];
            uint256 balance = IERC20Upgradeable(token).balanceOf(address(this));

            if (balance > 0) {
                totalWETH += _swapTokensForTokens(
                    token,
                    weth,
                    router,
                    balance,
                    address(this),
                    _buffer,
                    _deadline
                );
            }

            unchecked {
                ++i;
            }
        }
    }

    function _distributeWETHIntoNewTokens(
        address[] memory _newTokens,
        uint256[] memory _newWeights,
        uint256 wethAmount,
        uint256 _buffer,
        uint256 _deadline
    ) private {
        IFactory factory1 = _factory();
        address weth = factory1.weth();
        address router = factory1.router();

        uint256 tokensLength = _newWeights.length;
        uint256 totalAllocated;

        for (uint256 i = 0; i < tokensLength; ) {
            uint256 amountToSwap;

            if (i == tokensLength - 1) {
                amountToSwap = wethAmount - totalAllocated;
            } else {
                amountToSwap = (wethAmount * _newWeights[i]) / PERCENT_PRECISION;
                totalAllocated += amountToSwap;
            }

            _swapTokensForTokens(
                weth,
                _newTokens[i],
                router,
                amountToSwap,
                btsPair,
                _buffer,
                _deadline
            );

            unchecked {
                ++i;
            }
        }
    }




    function _swapTokensForTokens(
        address _tokenIn,
        address _tokenOut,
        address _router,
        uint256 _amountIn,
        address _to,
        uint256 _buffer,
        uint256 _deadline
    ) private returns (uint256) {
        IERC20Upgradeable(_tokenIn).safeApprove(_router, 0);
        IERC20Upgradeable(_tokenIn).safeApprove(_router, _amountIn);

        address[] memory path = _factory().getPath(_tokenIn, _tokenOut);
        if (path.length != 2) revert InvalidLength();

        uint256 _amountOutMin = (_factory().getAmountsOut(_amountIn, path) *
            (PERCENT_PRECISION - _buffer)) / PERCENT_PRECISION;

        uint256 balanceBefore = IERC20Upgradeable(_tokenOut).balanceOf(_to);
        IUniswapV2Router(_router)
            .swapExactTokensForTokensSupportingFeeOnTransferTokens(
                _amountIn,
                _amountOutMin,
                path,
                _to,
                _deadline
            );
        uint256 balanceAfter = IERC20Upgradeable(_tokenOut).balanceOf(_to);

        return balanceAfter - balanceBefore;
    }

    function _registerInterface(bytes4 interfaceId) internal virtual {
        if (interfaceId == 0xffffffff) revert InvalidInterfaceId();
        _supportedInterfaces[interfaceId] = true;
    }

    function _checkForDuplicateAddress(
        address[] memory _array,
        address _address,
        uint256 _startIndex
    ) internal pure returns (bool) {
        if (_array.length > _startIndex) {
            for (uint256 i = _startIndex; i < _array.length; ) {
                if (_array[i] == _address) revert DuplicateToken();
                unchecked {
                    ++i;
                }
            }
        }
        return false;
    }

 
    function _factory() private view returns (IFactory) {
        return IFactory(factory);
    }


    function isContractAddress(address target) internal view returns (bool) {
        return AddressUpgradeable.isContract(target);
    }


    function totalTokens() external view returns (uint256 tokenLength) {
        tokenLength = _tokenDetails.tokens.length;
    }


    function getTokenValueByWETH() public view returns (uint256 value) {
        IFactory factoryInstance = _factory(); // ✅ Cache factory
        address wethAddress = factoryInstance.weth(); // ✅ Cache weth
        uint256 tokensLength = _tokenDetails.tokens.length;
        
        for (uint256 i = 0; i < tokensLength; ) {
            address token = _tokenDetails.tokens[i]; // ✅ Cache token
            uint256 balance = IBTSPair(btsPair).getTokenReserve(i); // ✅ Cache balance
            
            address[] memory path = factoryInstance.getPath(token, wethAddress); // ✅ Cache path
            
            value += factoryInstance.getAmountsOut(balance, path); // Use cached values
            
            unchecked {
                ++i;
            }
        }
    }


    function contractURI() public view returns (string memory) {
        return _factory().getContractURI();
    }


    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721URIStorageUpgradeable, IERC165Upgradeable, IBTS)
        returns (bool)
    {
        return
            super.supportsInterface(interfaceId) ||
            _supportedInterfaces[interfaceId];
    }


    function royaltyInfo(
        uint256, /* _tokenId */
        uint256 _salePrice
    )
        external
        view
        override(IBTS, IERC2981Upgradeable)
        returns (address receiver, uint256 royaltyAmount)
    {
        receiver = _factory().royaltyReceiver();
        uint256 rate = _factory().royaltyPercentage();
        if (rate > 0 && receiver != address(0)) {
            royaltyAmount = (_salePrice * rate) / PERCENT_PRECISION;
        }
    }


    function getTokenDetails(uint256 _index)
        external
        view
        returns (address token, uint256 weight)
    {
        uint256 length = _tokenDetails.tokens.length;
        if (_index >= length) revert TokenIndexOutOfBounds(_index, length);
        token = _tokenDetails.tokens[_index];
        weight = _tokenDetails.weights[_index];
    }

 
    function getTokenDetails()
        external
        view
        returns (address[] memory tokens, uint256[] memory weights)
    {
        return (_tokenDetails.tokens, _tokenDetails.weights);
    }

 
    function getOwner() public view returns (address owner) {
        return ownerOf(0);
    }
}
