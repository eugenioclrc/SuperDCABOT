/**
 * Wallet connection store
 */

import { writable } from 'svelte/store';
import { createWalletClient, createPublicClient, custom, http, type WalletClient, type PublicClient, type Address } from 'viem';
import { sepolia } from 'viem/chains';
import { CHAIN_CONFIG } from '../contracts';
import type { WalletState } from '../types';

function createWalletStore() {
  const { subscribe, set, update } = writable<WalletState>({
    connected: false,
    address: null,
    chainId: null,
    publicClient: null,
    walletClient: null,
  });

  return {
    subscribe,

    async connect() {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet');
        return false;
      }

      try {
        const walletClient = createWalletClient({
          chain: sepolia,
          transport: custom(window.ethereum)
        });

        // Request account access
        const [address] = await walletClient.requestAddresses();
        const chainId = await walletClient.getChainId();

        // Check if on correct chain
        if (chainId !== CHAIN_CONFIG.chainId) {
          try {
            await walletClient.switchChain({ id: CHAIN_CONFIG.chainId });
          } catch (error: any) {
            console.error('Failed to switch chain:', error);
            return false;
          }
        }

        const publicClient = createPublicClient({
          chain: sepolia,
          transport: http(CHAIN_CONFIG.rpcUrls.default)
        });

        set({
          isConnected: true,
          address,
          chainId,
          publicClient,
          walletClient,
        });

        // Listen for account changes
        window.ethereum.on?.('accountsChanged', (accounts: string[]) => {
          if (accounts.length === 0) {
            this.disconnect();
          } else {
            update((state) => ({ ...state, address: accounts[0] as Address }));
          }
        });

        // Listen for chain changes
        window.ethereum.on?.('chainChanged', () => {
          window.location.reload();
        });

        return true;
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        return false;
      }
    },

    async switchChain() {
      // Logic handled in connect, but if specific method needed:
      if (typeof window.ethereum === 'undefined') return;
      // ... standard switch chain if needed externally ...
      // Since we have walletClient we can use it, but we need to get it from state?
      // For now, simple implementation or rely on connect's check.
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}` }],
        });
      } catch (error: any) {
        // Chain not added, add it
        if (error.code === 4902 || error.data?.originalError?.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${CHAIN_CONFIG.chainId.toString(16)}`,
                chainName: CHAIN_CONFIG.chainName,
                nativeCurrency: CHAIN_CONFIG.nativeCurrency,
                rpcUrls: [CHAIN_CONFIG.rpcUrls.public],
                blockExplorerUrls: [CHAIN_CONFIG.blockExplorer.url],
              },
            ],
          });
        }
      }
    },

    disconnect() {
      set({
        isConnected: false,
        address: null,
        chainId: null,
        publicClient: null,
        walletClient: null,
      });
    },
  };
}

export const wallet = createWalletStore();

// Type augmentation for window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}
