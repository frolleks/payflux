# payflux

a selfhostable cryptocurrency payment processor

## Local development

### Prerequisites

- Node.js v22.x+, Bun 1.2.x+
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

4. Set up environment variables

   Create a `.env` file in the root directory and add the following variables:

   ```env
   BITCOIN_HOST=
   BITCOIN_PORT=
   BITCOIN_USER=
   BITCOIN_PASS=

   WEBHOOK_SECRET=
   ```

   Replace the values with your Bitcoin Core configuration.

5. Start Bitcoin Core

   Ensure that your Bitcoin Core node is running and fully synchronized. When you are running this for development purposes, it is recommended to run Bitcoin Core in the test network.

   ```bash
   bitcoind -testnet -daemon -rpcuser=yourusername -rpcpassword=yourpassword -rpcport=8333
   ```

6. Start the development server

   ```bash
   bun dev
   ```

7. Open your browser and navigate to `http://localhost:3000` to access the application.
