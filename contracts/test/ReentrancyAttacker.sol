// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../interfaces/IBTSPair.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Interface for BasketTokenStandard with just the functions we need
interface IBasketTokenStandard {
    function contribute(uint256 _buffer, uint256 _deadline ) external payable;
    function withdraw(uint256 _liquidity, uint256 _deadline) external;
    function withdrawETH(uint256 _liquidity, uint256 _buffer, uint256 _deadline) external;
    receive() external payable;
}

/**
 * @title ReentrancyAttacker
 * @dev Contract to test reentrancy protection in BasketTokenStandard
 */
contract ReentrancyAttacker {
    address payable public btsAddress;
    address public btsPairAddress;
    bool public attacking = false;
    bool public attackSucceeded = false;
    string public revertReason = "";
    uint256 deadline;
    
    enum AttackType { NONE, CONTRIBUTE, WITHDRAW, WITHDRAW_ETH }
    AttackType public attackType = AttackType.NONE;
    
    // Events for debugging
    event AttackInitiated(string attackType);
    event ReceiveTriggered(uint256 amount);
    event AttackCompleted(bool success, string revertReason);
    
    // Receive function to handle ETH transfers
    receive() external payable {
        emit ReceiveTriggered(msg.value);
        
        // If we're in the middle of an attack, try to reenter
        if (attacking) {
            if (btsAddress != address(0)) {
                // Try to reenter the contract based on the attack type
                if (attackType == AttackType.CONTRIBUTE) {
                    // Try to call contribute again during the first contribute call
                    try IBasketTokenStandard(btsAddress).contribute{value: msg.value / 2}(100, deadline) {
                        // If this succeeds, the reentrancy guard is not working
                        attackSucceeded = true;
                    } catch Error(string memory reason) {
                        // Expected to fail with reentrancy guard
                        revertReason = reason;
                    } catch {
                        // Expected to fail with reentrancy guard
                        revertReason = "unknown error";
                    }
                } else if (attackType == AttackType.WITHDRAW) {
                    // Try to call withdraw again during the first withdraw call
                    try IBasketTokenStandard(btsAddress).withdraw(1, deadline) {
                        // If this succeeds, the reentrancy guard is not working
                        attackSucceeded = true;
                    } catch Error(string memory reason) {
                        // Expected to fail with reentrancy guard
                        revertReason = reason;
                    } catch {
                        // Expected to fail with reentrancy guard
                        revertReason = "unknown error";
                    }
                } else if (attackType == AttackType.WITHDRAW_ETH) {
                    // Try to call withdrawETH again during the first withdrawETH call
                    try IBasketTokenStandard(btsAddress).withdrawETH(1, 100, deadline) {
                        // If this succeeds, the reentrancy guard is not working
                        attackSucceeded = true;
                    } catch Error(string memory reason) {
                        // Expected to fail with reentrancy guard
                        revertReason = reason;
                    } catch {
                        // Expected to fail with reentrancy guard
                        revertReason = "unknown error";
                    }
                }
            }
        }
    }
    
    // Set the BTS contract address
    function setBTSAddress(address payable _btsAddress) external {
        btsAddress = _btsAddress;
    }
    
    // Set the BTS Pair contract address
    function setBTSPairAddress(address _btsPairAddress) external {
        btsPairAddress = _btsPairAddress;
    }
    
    // Attack the contribute function
    function attackContribute(uint256 _buffer, uint256 _deadline) external payable {
        require(btsAddress != address(0), "BTS address not set");
        emit AttackInitiated("contribute");
        
        attackType = AttackType.CONTRIBUTE;
        attacking = true;
        attackSucceeded = false;
        revertReason = "";
        deadline = _deadline;
        
        // Call contribute, which will send ETH to this contract via the receive function
        try IBasketTokenStandard(btsAddress).contribute{value: msg.value}(_buffer, _deadline) {
            // If we get here, the initial contribute call succeeded
            // but we need to check if our reentrancy attempt succeeded
            if (attackSucceeded) {
                revert("Reentrancy attack succeeded");
            }
        } catch Error(string memory reason) {
            revertReason = reason;
        } catch {
            revertReason = "unknown error";
        }
        
        attacking = false;
        attackType = AttackType.NONE;
        emit AttackCompleted(attackSucceeded, revertReason);
    }
    
    // Attack the withdraw function
    function attackWithdraw(uint256 _deadline) external {
        require(btsAddress != address(0), "BTS address not set");
        require(btsPairAddress != address(0), "BTS Pair address not set");
        emit AttackInitiated("withdraw");
        
        attackType = AttackType.WITHDRAW;
        attacking = true;
        attackSucceeded = false;
        revertReason = "";
        deadline = _deadline;
        
        // Get our LP token balance
        uint256 lpBalance = IERC20(btsPairAddress).balanceOf(address(this));
        // Approve the BTS contract to spend our LP tokens
        IERC20(btsPairAddress).approve(btsAddress, lpBalance);
        
        // Call withdraw, which should trigger a callback to this contract
        try IBasketTokenStandard(btsAddress).withdraw(lpBalance, _deadline) {
            // If we get here, the initial withdraw call succeeded
            // but we need to check if our reentrancy attempt succeeded
            if (attackSucceeded) {
                revert("Reentrancy attack succeeded");
            }
        } catch Error(string memory reason) {
            revertReason = reason;
        } catch {
            revertReason = "unknown error";
        }
        
        attacking = false;
        attackType = AttackType.NONE;
        emit AttackCompleted(attackSucceeded, revertReason);
    }
    
    // Attack the withdrawETH function
    function attackWithdrawETH(uint256 _buffer, uint256 _deadline) external {
        require(btsAddress != address(0), "BTS address not set");
        require(btsPairAddress != address(0), "BTS Pair address not set");
        emit AttackInitiated("withdrawETH");
        
        attackType = AttackType.WITHDRAW_ETH;
        attacking = true;
        attackSucceeded = false;
        revertReason = "";
        deadline = _deadline;
        
        // Get our LP token balance
        uint256 lpBalance = IERC20(btsPairAddress).balanceOf(address(this));
        // Approve the BTS contract to spend our LP tokens
        IERC20(btsPairAddress).approve(btsAddress, lpBalance);
        
        // Call withdrawETH, which should trigger a callback to this contract
        try IBasketTokenStandard(btsAddress).withdrawETH(lpBalance, _buffer, _deadline) {
            // If we get here, the initial withdrawETH call succeeded
            // but we need to check if our reentrancy attempt succeeded
            if (attackSucceeded) {
                revert("Reentrancy attack succeeded");
            }
        } catch Error(string memory reason) {
            revertReason = reason;
        } catch {
            revertReason = "unknown error";
        }
        
        attacking = false;
        attackType = AttackType.NONE;
        emit AttackCompleted(attackSucceeded, revertReason);
    }
}
