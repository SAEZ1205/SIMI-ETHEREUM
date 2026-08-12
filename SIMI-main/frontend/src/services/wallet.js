import { BrowserProvider, ZeroAddress, formatEther, keccak256, toUtf8Bytes } from 'ethers';

export const ARBITRUM_SEPOLIA = {
  chainId: 421614,
  chainIdHex: '0x66eee',
  chainName: 'Arbitrum Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
  blockExplorerUrls: ['https://sepolia.arbiscan.io'],
};

const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS || ZeroAddress;

function ethereum() {
  if (!window.ethereum) throw new Error('METAMASK_NOT_FOUND');
  return window.ethereum;
}

export async function connectWallet() {
  const accounts = await ethereum().request({ method: 'eth_requestAccounts' });
  await switchToArbitrumSepolia();
  return getWalletSnapshot(accounts?.[0]);
}

export async function switchToArbitrumSepolia() {
  const eth = ethereum();
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARBITRUM_SEPOLIA.chainIdHex }] });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await eth.request({ method: 'wallet_addEthereumChain', params: [ARBITRUM_SEPOLIA] });
  }
}

export async function getWalletSnapshot(preferredAccount) {
  if (!window.ethereum) return { installed: false, connected: false, account: '', chainId: 0, balance: '0' };
  const provider = new BrowserProvider(window.ethereum);
  const accounts = preferredAccount ? [preferredAccount] : await window.ethereum.request({ method: 'eth_accounts' });
  const network = await provider.getNetwork();
  const account = accounts?.[0] || '';
  let balance = '0';
  if (account) {
    const raw = await provider.getBalance(account);
    balance = Number(formatEther(raw)).toFixed(4);
  }
  return { installed: true, connected: Boolean(account), account, chainId: Number(network.chainId), balance };
}

export function shortAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export async function signHolderDecision(request, action) {
  const provider = new BrowserProvider(ethereum());
  const signer = await provider.getSigner();
  const holder = await signer.getAddress();
  const now = Math.floor(Date.now() / 1000);
  const nonce = Number(request.nonce || 1);
  const expiresAt = Number(request.expiresAt || now + 24 * 60 * 60);
  const requestId = keccak256(toUtf8Bytes(request.id));
  const subscriberHash = keccak256(toUtf8Bytes(`${request.id}:${request.line}`));
  const domain = { name: 'SIMI', version: '2', chainId: ARBITRUM_SEPOLIA.chainId, verifyingContract: contractAddress };
  const types = { Consent: [
    { name: 'requestId', type: 'bytes32' },
    { name: 'subscriberHash', type: 'bytes32' },
    { name: 'holder', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'action', type: 'string' },
  ] };
  const value = { requestId, subscriberHash, holder, nonce, expiresAt, action };
  const signature = await signer.signTypedData(domain, types, value);
  return { signature, signer: holder, payload: value, domain };
}

export async function signIdentityVerification(request) {
  const provider = new BrowserProvider(ethereum());
  const signer = await provider.getSigner();
  const verifier = await signer.getAddress();
  const now = Math.floor(Date.now() / 1000);
  const nonce = Number(request.nonce || 1);
  const expiresAt = Number(request.expiresAt || now + 24 * 60 * 60);
  const holder = request.holderAddress || verifier;
  const requestId = keccak256(toUtf8Bytes(request.id));
  const subscriberHash = keccak256(toUtf8Bytes(`${request.id}:${request.line}`));
  const proofHash = keccak256(toUtf8Bytes(`${request.id}:identity-verified:demo`));
  const domain = { name: 'SIMI', version: '2', chainId: ARBITRUM_SEPOLIA.chainId, verifyingContract: contractAddress };
  const types = { Verification: [
    { name: 'requestId', type: 'bytes32' },
    { name: 'subscriberHash', type: 'bytes32' },
    { name: 'holder', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'proofHash', type: 'bytes32' },
  ] };
  const value = { requestId, subscriberHash, holder, nonce, expiresAt, proofHash };
  const signature = await signer.signTypedData(domain, types, value);
  return { signature, signer: verifier, payload: value, domain };
}
