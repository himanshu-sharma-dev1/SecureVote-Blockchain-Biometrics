# SecureVote-Blockchain-Biometrics

## 🗳️ Decentralized Voting (dVoting) with Biometric Verification

**SecureVote-Blockchain-Biometrics** is a cutting-edge decentralized voting system built on the Ethereum blockchain, enhanced with real-time facial recognition for unparalleled voter authenticity and election integrity. This project redefines traditional voting by offering a transparent, tamper-proof, and biometrically secure platform.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

*   **✅ Decentralized & Transparent:** Built on Ethereum, ensuring every vote is immutably recorded and publicly verifiable.
*   **👤 Biometric Voter Verification:** Integrates in-browser facial recognition (using `face-api.js`) to prevent identity fraud without storing sensitive data remotely.
*   **🔒 Tamper-Proof Voting:** Votes are secured by blockchain, making alteration impossible once cast.
*   **⚙️ Admin Panel:** Comprehensive tools for election management, including creating/stopping elections, adding candidates, and approving voter registrations.
*   **🚀 User-Friendly Interface:** An intuitive React.js frontend designed for a seamless voting experience.
*   **🛡️ Single-Vote Assurance:** Smart contracts enforce one-vote-per-user, maintaining election fairness.

## 🛠️ Technical Stack

*   **Blockchain Layer:** Ethereum, Solidity, Truffle, Ganache
*   **Frontend:** React.js, HTML, CSS, Framer Motion
*   **Facial Recognition:** `face-api.js` (TensorFlow.js wrapper)
*   **Wallet Integration:** MetaMask
*   **Session Management:** `localStorage`

## 🚀 System Workflow

1.  **Election Setup:** The Admin initializes an election, defines its parameters, and registers candidates.
2.  **Voter Registration:** Prospective voters undergo a mandatory facial verification via webcam. Upon successful verification, they submit their details for admin approval.
3.  **Admin Verification:** The admin reviews and approves/rejects voter registrations, granting voting eligibility.
4.  **Casting Vote:** Approved voters re-authenticate via facial recognition and cast their vote for their chosen candidate.
5.  **Results & Conclusion:** Post-election, the admin concludes the voting, and the system transparently displays the results, including the winner and vote counts.

## 💻 Setting up the Development Environment

### Requirements

*   [Node.js](https://nodejs.org/)
*   [Truffle](https://www.trufflesuite.com/truffle)
*   [Ganache](https://www.trufflesuite.com/ganache) (CLI or GUI)
*   [MetaMask](https://metamask.io/) (Browser Extension)

### Installation & Configuration

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/himanshu-sharma-dev1/SecureVote-Blockchain-Biometrics.git
    cd SecureVote-Blockchain-Biometrics
    ```
2.  **Start your local Ethereum blockchain (Ganache):**
    ```bash
    ganache-cli
    ```
    *Note: Keep Ganache running throughout the development process.*
3.  **Configure MetaMask:**
    *   Add a custom RPC network in MetaMask:
        *   **New RPC URL:** `http://127.0.0.1:8545` (Use `7545` for Ganache GUI; update `truffle-config.js` accordingly).
        *   **Chain ID:** `1337`
    *   Import accounts from Ganache (using their private keys) into MetaMask.
4.  **Deploy Smart Contracts:**
    Navigate to the project root directory and run:
    ```bash
    truffle migrate
    ```
    *For re-deployments, use `truffle migrate --reset`.*
5.  **Launch the Frontend Application:**
    Navigate to the `client` directory and install dependencies, then start the app:
    ```bash
    cd client
    npm install
    npm start
    ```

## 📈 Future Enhancements (To-Do List)

*   **Email/OTP Verification:** Implement additional verification layers during voter registration.
*   **Automated Verification:** Explore automated voter approval mechanisms.
*   **Comprehensive Reporting:** Generate detailed election reports with statistical insights and visualizations.
*   **Multi-Election Support:** Enable the creation and management of multiple election instances without contract re-deployment.
*   **Secure Face Descriptor Storage:** Develop a backend solution for secure storage of facial descriptors.
*   **Liveness Detection:** Integrate anti-spoofing measures for enhanced biometric security.
*   **Mobile Responsiveness:** Optimize the user interface for seamless experience across mobile devices.
*   **Testnet Deployment:** Transition the application from local development to public test networks (e.g., Goerli, Polygon Mumbai).

## 🤝 Contributing

Contributions are welcome! Please feel free to open issues or submit pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.