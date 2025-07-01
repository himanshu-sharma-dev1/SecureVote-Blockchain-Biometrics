# Decentralized Voting (dVoting)

A decentralized voting system based on Ethereum blockchain technology, with biometric voter verification using facial recognition.

This project aims to provide a secure, transparent, and tamper-proof voting process by leveraging the power of blockchain and biometrics.

## System Workflow

A brief explanation on the basic workflow of the application.

1.  **Election Setup:** The Admin creates an election, sets the details (title, organization), and adds candidates that voters can choose from.
2.  **Voter Registration:** Prospective voters connect to the application. Before they can register, they must verify their identity using their webcam for facial recognition. Once verified, they can submit their registration details (name, phone number) to the admin for approval.
3.  **Admin Verification:** The admin reviews the pending voter registrations. They can approve or reject voters based on their records.
4.  **Voting:** Approved voters can then cast their vote. They must perform facial recognition again to authenticate themselves before being allowed to vote. Each voter can only vote once.
5.  **Results:** Once the admin ends the election, the results are calculated and displayed, showing the winner and the vote count for each candidate.

## Setting up the development environment

### Requirements

*   Node.js
*   Truffle
*   Ganache (CLI or GUI)
*   Metamask (Browser Extension)

### Getting the requirements

1.  **Download and install NodeJS** from [here](https://nodejs.org/).
2.  **Install truffle and ganache-cli** using node packager manager (npm)
    ```bash
    npm install -g truffle
    npm install -g ganache-cli
    ```
3.  **Install metamask browser extension** from [here](https://metamask.io/).

### Configuring the project for development

1.  **Clone this repository**
    ```bash
    git clone <your-repository-url>
    cd dVoting
    ```
2.  **Run local Ethereum blockchain**
    ```bash
    ganache-cli
    ```
    *Note: Do not close ganache-cli (the blockchain network needs to be running all the time)*
3.  **Configure metamask on the browser** with the following details
    *   **New RPC URL:** `http://127.0.0.1:8545` (use port: `7545` for ganache gui, update it in the file:`truffle-config.js` as well)
    *   **Chain ID:** `1337`
    *   Import account(s) using private keys from ganache-cli to the metamask extension on the browser
4.  **Deploy smart contract** to the (local) blockchain network (i.e ganache-cli)
    ```bash
    # on the dVoting directory
    truffle migrate
    ```
    *Note: Use `truffle migrate --reset` for re-deployments*
5.  **Launch the development server (frontend)**
    ```bash
    cd client
    npm install
    npm start
    ```

## To-Do List

Possible features to add/improve within the app.

*   **OTP/Email Verification:** Adding email/phone verification (OTP, etc..) while registering for voters.
*   **Report Generation:** Option to generate a report at the end of an election. The report could contain a range of information including the number of people that were eligible to vote, the number of people that participated in the election, a bar-chart/pie-chart showing the election statistics, etc.
*   **Multiple Election Instance:** Ability to create multiple election instances without having to re-deploy the smart contract.
*   **Backend Database:** Store face descriptors securely with a backend
*   **Enhanced Security:** Prevent spoofing using liveness detection (anti-photo attack)
*   **Mobile Optimization:** Improve UI for smartphones and smaller screens
*   **Testnet Deployment:** Move from Ganache to Goerli or Polygon Mumbai testnet
