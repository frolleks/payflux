# payflux

a selfhostable cryptocurrency payment processor

## Local development

### Prerequisites

- Node.js 22.x+, Bun 1.3.x+
- Bitcoin Core v28+
- Git

### Steps to get up and running

1. Clone the repository

   ```bash
   git clone https://github.com/frolleks/payflux.git
   ```

2. Navigate to the project directory

   ```bash
   cd payflux
   ```

3. Install dependencies

   ```bash
    bun install
   ```

4. Start Bitcoin Core

   Ensure that your Bitcoin Core node is running and fully synchronized. When you are running this for development purposes, it is recommended to run Bitcoin Core in the test network.

   ```bash
   bitcoind -testnet4 -daemon -rpcuser=yourusername -rpcpassword=yourpassword -rpcport=8333
   ```

5. Set up environment variables

   Create a `.env` file in the root directory and add the following variables:

   ```env
   BITCOIN_HOST=
   BITCOIN_PORT=
   BITCOIN_USER=
   BITCOIN_PASS=

   WEBHOOK_SECRET=

   MNEMONIC= # optional, for generating Ethereum wallet addresses and enabling ETH payments
   ETHERSCAN_API_KEY= # optional, for enabling ETH payments
   ```

   Replace the values with your Bitcoin Core configuration.

6. Start the development server

   ```bash
   bun --filter "*" dev
   ```

7. Open your browser and navigate to `http://localhost:5173` to access the application.
