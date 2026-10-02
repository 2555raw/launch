walletconnect.min.js is @walletconnect/ethereum-provider 2.25.0 with
@walletconnect/modal 2.7.0, bundled for the browser with esbuild:

    import { EthereumProvider } from '@walletconnect/ethereum-provider';
    window.WalletConnectEthereumProvider = EthereumProvider;

    esbuild entry.js --bundle --minify --format=iife --platform=browser --target=es2020

WalletConnect packages are licensed under Apache-2.0
(https://github.com/WalletConnect/walletconnect-monorepo). The page only
downloads this file when someone picks WalletConnect in the wallet list.
