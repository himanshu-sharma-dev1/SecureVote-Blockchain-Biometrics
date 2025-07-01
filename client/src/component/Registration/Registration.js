// Node modules
import React, { Component } from "react";
import { Link } from "react-router-dom";
// Import useHistory for navigation within the wrapper
import { useHistory } from "react-router-dom";

// Components
import Navbar from "../Navbar/Navigation";
import NavbarAdmin from "../Navbar/NavigationAdmin";
import NotInit from "../NotInit";

// CSS
import "./Registration.css";

// Contract
import getWeb3 from "../../getWeb3";
import Election from "../../contracts/Election.json";

// Create a functional wrapper component to provide the history prop
function RegistrationWrapper(props) {
  const history = useHistory();
  return <Registration {...props} history={history} />; // Pass history as prop
}

class Registration extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ElectionInstance: undefined,
      web3: null,
      account: null,
      isAdmin: false,
      isElStarted: false,
      isElEnded: false,
      voterCount: 0, // Initialize as 0
      voterName: "",
      voterPhone: "",
      voters: [],
      currentVoter: {
        address: undefined,
        name: null,
        phone: null,
        hasVoted: false,
        isVerified: false, // Verified by Admin
        isRegistered: false,
      },
      // --- NEW STATE FOR BETTER UX & LOGIC ---
      isLoading: true, // For initial loading and transaction processing
      statusMessage: "", // To display messages to the user (errors, success, info)
      isFaceVerifiedByLocalStorage: false, // Tracks status from localStorage
    };
  }

  // Refreshing once and initial data load
  componentDidMount = async () => {
    console.log("Registration CDM: Component did mount.");
    this.updateFaceVerificationStatusFromLocalStorage(); // Check localStorage immediately

    if (!window.location.hash) {
      console.log("Registration CDM: No hash found, forcing reload.");
      window.location = window.location + "#loaded";
      window.location.reload();
      return; // Stop further execution until page reloads
    }
    console.log("Registration CDM: Hash found or page reloaded, proceeding to load blockchain data.");
    await this.loadBlockchainData();
  };

  // Helper to read face verification status from localStorage and update state
  updateFaceVerificationStatusFromLocalStorage = () => {
    const faceVerifiedStatus = localStorage.getItem("isFaceVerified") === "true";
    console.log("Registration: Updated isFaceVerifiedByLocalStorage from localStorage:", faceVerifiedStatus);
    this.setState({ isFaceVerifiedByLocalStorage: faceVerifiedStatus });
  };

  loadBlockchainData = async () => {
    console.log("Registration LBD: Attempting to load blockchain data...");
    this.setState({ isLoading: true, statusMessage: "Connecting to blockchain and loading data..." });
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Make sure MetaMask is unlocked and connected.");
      }
      const account = accounts[0];

      const networkId = await web3.eth.net.getId();
      const deployedNetwork = Election.networks[networkId];
      if (!deployedNetwork) {
        throw new Error("Election contract not deployed on this network. Please check your MetaMask network settings.");
      }

      const instance = new web3.eth.Contract(
        Election.abi,
        deployedNetwork.address
      );

      this.setState({ web3, ElectionInstance: instance, account });
      console.log("Registration LBD: Web3, Contract Instance, and Account are set. Account:", account);

      const admin = await instance.methods.getAdmin().call();
      if (account === admin) {
        this.setState({ isAdmin: true });
      }

      const start = await instance.methods.getStart().call();
      const end = await instance.methods.getEnd().call();
      this.setState({ isElStarted: start, isElEnded: end });

      const voterCountRaw = await instance.methods.getTotalVoter().call();
      const voterCount = Number(voterCountRaw); // Ensure it's a JS number
      this.setState({ voterCount });
      console.log("Registration LBD: Total voter count from contract:", voterCount);

      const fetchedVoters = [];
      if (voterCount > 0) {
        console.log(`Registration LBD: Loading details for ${voterCount} voters.`);
        for (let i = 0; i < voterCount; i++) {
          try {
            // Assuming your contract has a public array `voterAddresses` or a getter `voters(index)`
            const voterAddress = await instance.methods.voters(i).call();
            const voterDetails = await instance.methods.voterDetails(voterAddress).call();
            fetchedVoters.push({
              address: voterDetails.voterAddress,
              name: voterDetails.name,
              phone: voterDetails.phone,
              hasVoted: voterDetails.hasVoted,
              isVerified: voterDetails.isVerified,
              isRegistered: voterDetails.isRegistered,
            });
          } catch(e) {
            console.error(`Registration LBD: Error fetching voter at index ${i}.`, e);
            // Continue fetching others if one fails
          }
        }
      }
      this.setState({ voters: fetchedVoters });
      console.log("Registration LBD: Voters list loaded:", fetchedVoters);

      const currentVoterDetails = await instance.methods.voterDetails(account).call();
      this.setState({
        currentVoter: {
          address: currentVoterDetails.voterAddress,
          name: currentVoterDetails.name,
          phone: currentVoterDetails.phone,
          hasVoted: currentVoterDetails.hasVoted,
          isVerified: currentVoterDetails.isVerified,
          isRegistered: currentVoterDetails.isRegistered,
        },
        isLoading: false,
        statusMessage: "Blockchain data loaded successfully.",
      });
      console.log("Registration LBD: Current voter details:", currentVoterDetails);

    } catch (error) {
      console.error("Registration LBD: Critical error during blockchain data load:", error);
      this.setState({
        isLoading: false,
        statusMessage: `Error loading data: ${error.message}. Please check console and refresh.`,
        web3: null, // Indicate that web3/contract setup failed
      });
    }
  };

  updateVoterName = (event) => {
    this.setState({ voterName: event.target.value, statusMessage: "" }); // Clear status on edit
  };

  updateVoterPhone = (event) => {
    this.setState({ voterPhone: event.target.value, statusMessage: "" }); // Clear status on edit
  };

  registerAsVoter = async () => {
    console.log("Registration RegV: 'Register as Voter' button clicked.");
    this.setState({ isLoading: true, statusMessage: "Processing registration..." });

    // Destructure needed state for clarity
    const { ElectionInstance, voterName, voterPhone, account, currentVoter, isFaceVerifiedByLocalStorage } = this.state;

    // Check 1: Contract instance ready?
    if (!ElectionInstance) {
      this.setState({ isLoading: false, statusMessage: "Error: Contract not initialized. Please refresh." });
      console.error("Registration RegV: ElectionInstance is not available.");
      return;
    }

    // Check 2: Form fields validation
    const trimmedName = voterName.trim();
    const trimmedPhone = voterPhone.trim();
    if (!trimmedName || !trimmedPhone) {
      this.setState({ isLoading: false, statusMessage: "Error: Name and Phone Number fields cannot be empty." });
      return;
    }
    if (trimmedPhone.length !== 10 || !/^\d{10}$/.test(trimmedPhone)) {
      this.setState({ isLoading: false, statusMessage: "Error: Please enter a valid 10-digit phone number." });
      return;
    }

    // Check 3: Facial Verification for NEW registrations
    // (currentVoter.isRegistered should be false if it's a truly new user for this account)
    console.log("Registration RegV: Checking conditions: isFaceVerifiedByLocalStorage:", isFaceVerifiedByLocalStorage, "currentVoter.isRegistered:", currentVoter.isRegistered);
    if (!currentVoter.isRegistered && !isFaceVerifiedByLocalStorage) {
      this.setState({ isLoading: false, statusMessage: "Error: Facial verification is required for new voter registration." });
      console.log("Registration RegV: Registration blocked. New user requires facial verification.");
      // UI should guide them to the facial verification button
      return;
    }

    console.log("Registration RegV: All checks passed. Proceeding with smart contract transaction...");
    try {
      const receipt = await ElectionInstance.methods
        .registerAsVoter(trimmedName, trimmedPhone)
        .send({ from: account, gas: 1500000 }); // Using a slightly higher gas limit; monitor this.

      console.log("Registration RegV: Transaction successful. Receipt:", receipt);
      if (receipt.status) { // Check transaction status from receipt
        this.setState({
          statusMessage: "Registration successful! Page will now reload.",
          voterName: "", // Clear form fields
          voterPhone: "",
        });
        alert("Registration Successful!"); // Provide immediate feedback

        // IMPORTANT: Clear the face verification flag from localStorage AFTER successful registration
        localStorage.removeItem("isFaceVerified");
        this.setState({ isFaceVerifiedByLocalStorage: false }); // Update component state to reflect removal

        console.log("Registration RegV: isFaceVerified flag removed from localStorage. Reloading page...");
        window.location.reload(); // Reload to fetch fresh data including new voter
      } else {
        // This case (receipt.status is false) indicates a failed transaction that didn't throw an error (less common with modern web3)
        console.error("Registration RegV: Transaction failed on-chain but did not throw. Receipt:", receipt);
        this.setState({ isLoading: false, statusMessage: "Error: Registration transaction submitted but failed on the blockchain. See console." });
      }
    } catch (error) {
      console.error("Registration RegV: Error during 'registerAsVoter' smart contract call:", error);
      let userFriendlyMessage = "Registration failed. See console for technical details.";
      if (error.message) {
        if (error.message.includes("User denied transaction signature")) {
          userFriendlyMessage = "Registration Canceled: You rejected the transaction in MetaMask.";
        } else if (error.message.toLowerCase().includes("revert")) {
          // Try to extract a more specific revert reason if available
          const reasonMatch = error.message.match(/revert(?:ed)?(?: with reason string)? '([^']*)'/);
          const reason = reasonMatch && reasonMatch[1] ? reasonMatch[1] : "A condition in the smart contract was not met (e.g., already registered, invalid input).";
          userFriendlyMessage = `Registration Failed: Transaction Reverted. Reason: ${reason}`;
        } else if (error.message.toLowerCase().includes("out of gas")) {
          userFriendlyMessage = "Registration Failed: Transaction ran out of gas. The operation might be too complex for the gas limit.";
        }
      }
      this.setState({ isLoading: false, statusMessage: userFriendlyMessage });
    }
  };


  render() {
    const { history } = this.props; // from RegistrationWrapper
    const {
      web3,
      isAdmin,
      isElStarted,
      isElEnded,
      voters, // The list of all voters
      currentVoter, // Details of the currently connected MetaMask account
      voterName, // Form input
      voterPhone, // Form input
      isLoading,
      statusMessage,
      isFaceVerifiedByLocalStorage, // Reflects localStorage state
    } = this.state;

    // ---- Initial Loading States ----
    if (isLoading && !this.state.ElectionInstance) { // Show this if web3/contract is still loading
      return (
        <>
          {isAdmin ? <NavbarAdmin /> : <Navbar />}
          <center style={{ padding: "30px" }}>
            <h2>Loading Application & Connecting to Blockchain...</h2>
            <p>{statusMessage || "Please wait."}</p>
            {/* You could add a spinner/loading animation here */}
          </center>
        </>
      );
    }
    if (!web3 && !isLoading) { // Show this if web3/contract loading failed
        return (
          <>
            {isAdmin ? <NavbarAdmin /> : <Navbar />}
            <center style={{ padding: "30px" }}>
              <h2>Application Error</h2>
              <p>{statusMessage || "Failed to load essential blockchain components. Please ensure MetaMask is installed, connected to the correct network, and then refresh the page."}</p>
              <button onClick={() => window.location.reload()} style={{padding: "10px 15px", marginTop:"10px"}}>Refresh Page</button>
            </center>
          </>
        );
    }

    // ---- Election Status Check ----
    // If election is not started or has ended, and we are not in an initial loading phase
    if ((!isElStarted && !isElEnded) && !isLoading && this.state.ElectionInstance) {
      return (
        <>
          {isAdmin ? <NavbarAdmin /> : <Navbar />}
          <NotInit /> {/* Component indicating election status */}
        </>
      );
    }

    // ---- Main Registration UI Logic ----
    // Can the user see the registration form?
    // Yes if:
    // 1. They are already registered (currentVoter.isRegistered is true) - they might see their details.
    // 2. They are NOT registered BUT their face HAS BEEN verified (isFaceVerifiedByLocalStorage is true).
    const canSeeRegistrationFormArea = currentVoter.isRegistered || (!currentVoter.isRegistered && isFaceVerifiedByLocalStorage);

    return (
      <>
        {isAdmin ? <NavbarAdmin /> : <Navbar />}
        <div className="container-main-heading" style={{ textAlign: "center", marginTop: "20px", marginBottom: "10px" }}>
            <h2>Voter Registration</h2>
        </div>

        {/* Display Status Messages (Errors, Success, Info) */}
        {statusMessage && (
            <div style={{
                textAlign: "center", padding: "10px", margin: "10px auto", maxWidth: "700px",
                borderRadius: "5px", border: "1px solid",
                borderColor: statusMessage.toLowerCase().includes("error") || statusMessage.toLowerCase().includes("failed") ? "#d32f2f" : (statusMessage.toLowerCase().includes("success") ? "#388e3c" : "#1976d2"),
                backgroundColor: statusMessage.toLowerCase().includes("error") || statusMessage.toLowerCase().includes("failed") ? "#ffebee" : (statusMessage.toLowerCase().includes("success") ? "#e8f5e9" : "#e3f2fd"),
                color: statusMessage.toLowerCase().includes("error") || statusMessage.toLowerCase().includes("failed") ? "#d32f2f" : (statusMessage.toLowerCase().includes("success") ? "#388e3c" : "#1976d2"),
            }}>
                <p style={{margin:0}}>{statusMessage}</p>
            </div>
        )}
        {/* General loading indicator when a transaction is in progress but no specific error/success yet */}
        {isLoading && statusMessage && statusMessage.toLowerCase().includes("processing") && <div style={{textAlign: "center"}}><p><i>Please wait... Do not navigate away.</i></p></div>}


        <div className="container-item info">
          {/* Display total voter count from contract vs. length of frontend list */}
          <p>Registered Voters (from contract): {this.state.voterCount} --- (Frontend list count: {voters.length})</p>
        </div>

        <div className="container-main">
          {/* Section for Registration Form or "Go to Facial Verification" prompt */}
          {!canSeeRegistrationFormArea && !currentVoter.isRegistered ? (
            // Case: New user, face NOT verified yet. Prompt for facial verification.
            <div style={{ textAlign: "center", marginTop: "30px", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
              <h3>Facial Verification Required</h3>
              <p>To register as a new voter, please complete facial verification first.</p>
              <button
                 onClick={() => {
                    this.setState({statusMessage: "Redirecting to facial verification..."});
                    history.push("/facial", { redirectTo: "registration" }); // Pass redirectTo state
                 }}
                 style={{
                   padding: "12px 25px", backgroundColor: "#27ae60", color: "white",
                   border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "16px", marginTop: "10px"
                 }}
                 disabled={isLoading} // Disable if another operation is loading
              >
                Verify Face Now
              </button>
            </div>
          ) : (
            // Case: User is either already registered OR is a new user who HAS passed face verification.
            <div className="container-item">
              {/* Message if user is already admin-verified (cannot update) */}
              {currentVoter.isRegistered && currentVoter.isVerified && (
                   <p style={{ color: 'green', textAlign: 'center', fontWeight: 'bold' }}>
                       Your registration is complete and has been verified by the administrator. Details cannot be updated.
                   </p>
               )}

              {/* Show the registration form if:
                  1. User is NOT admin-verified (currentVoter.isVerified is false)
                  AND
                  2. (User IS already registered OR User is NOT registered BUT IS face-verified)
                  This effectively means the form shows for new, face-verified users, or for registered users who are not yet admin-verified.
              */}
              {(!currentVoter.isVerified) && (
                   <form onSubmit={(e) => { e.preventDefault(); this.registerAsVoter(); }}>
                      <div className="div-li">
                        <label className={"label-r"}>
                          Account Address
                          <input
                            className={"input-r"} type="text" value={this.state.account || 'N/A (Connect MetaMask)'}
                            style={{ width: "100%", maxWidth: "400px" }} readOnly
                          />
                        </label>
                      </div>
                      <div className="div-li">
                        <label className={"label-r"}>
                          Full Name <span style={{ color: "tomato" }}>*</span>
                          <input
                            className={"input-r"} type="text" placeholder="e.g., Alex Voter"
                            value={voterName} onChange={this.updateVoterName}
                            disabled={isLoading || currentVoter.isVerified} // Disable if loading or already admin-verified
                            required
                          />
                        </label>
                      </div>
                      <div className="div-li">
                        <label className={"label-r"}>
                          Phone Number (10 digits) <span style={{ color: "tomato" }}>*</span>
                          <input
                            className={"input-r"} type="tel" placeholder="e.g., 9876543210"
                            value={voterPhone} onChange={this.updateVoterPhone}
                            disabled={isLoading || currentVoter.isVerified} // Disable if loading or already admin-verified
                            required pattern="\d{10}" title="Must be a 10-digit phone number."
                          />
                        </label>
                      </div>
                      <p className="note">
                        <span style={{ color: "tomato" }}>Important:</span> Ensure your Name and Phone Number are correct.
                        Admin approval may depend on this information matching official records.
                      </p>
                      <button
                        type="submit" className="btn-add"
                        disabled={
                          isLoading ||
                          currentVoter.isVerified || // Cannot register/update if already admin-verified
                          (!isFaceVerifiedByLocalStorage && !currentVoter.isRegistered) || // Safety: New user must be face-verified
                          !voterName.trim() || // Form validation
                          !voterPhone.trim() ||
                          voterPhone.trim().length !== 10
                        }
                      >
                        {isLoading
                          ? "Processing..."
                          : currentVoter.isRegistered // If already registered (but not admin verified)
                          ? "Update My Details" // Or "Details Submitted" if updates aren't really processed by contract
                          : "Register as Voter"}
                      </button>
                   </form>
               )}
            </div>
          )}
        </div>

        {/* Display Current Voter's Info */}
        <div className="container-main" style={{ borderTop: "1px solid #eee", marginTop: "30px", paddingTop: "20px" }}>
          {loadCurrentVoter(currentVoter, currentVoter.isRegistered)}
        </div>

        {/* Admin Section: Display All Voters */}
        {isAdmin && (
          <div className="container-main" style={{ borderTop: "1px solid #ccc", marginTop: "30px", paddingTop: "20px" }}>
            <h3>Administrator Panel: All Voters</h3>
            <small>Total Voters (from contract): {this.state.voterCount}</small><br/>
            <small>Listed Voters (frontend count): {this.state.voters.length}</small>
            {/* Warning if contract count and frontend list length mismatch */}
            {this.state.voters.length !== this.state.voterCount && !isLoading && this.state.voterCount > 0 &&
                <p style={{color: "orange", fontWeight:"bold"}}>Warning: Mismatch detected. Contract reports {this.state.voterCount} voters, but {this.state.voters.length} are listed. There might have been an error fetching some voter details. Check console.</p>
            }
            {loadAllVoters(this.state.voters)}
          </div>
        )}
      </>
    );
  }
}

// loadCurrentVoter and loadAllVoters functions (using the ones from your latest provided code, slightly enhanced)
export function loadCurrentVoter(voter, isRegistered) {
  return (
    <>
      <div className={"container-item " + (isRegistered ? "success" : "attention")} style={{ padding: "10px", borderRadius: "5px", marginBottom: "10px" }}>
        <center><strong>Your Current Registration Status</strong></center>
      </div>
      <div className={"container-list " + (isRegistered ? "success" : "attention")} style={{ background: isRegistered ? "#e6ffed" : "#fff0f0", padding: "15px", borderRadius: "5px" }}>
        <table>
          <tbody>
            <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Account Address:</th><td>{voter.address || 'N/A'}</td></tr>
            <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Name:</th><td>{voter.name || 'Not Provided'}</td></tr>
            <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Phone:</th><td>{voter.phone || 'Not Provided'}</td></tr>
            <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Has Voted:</th><td>{voter.hasVoted ? "Yes" : "No"}</td></tr>
            <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Admin Verified:</th><td>{voter.isVerified ? "Yes" : "No"}</td></tr>
            <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Registered on Blockchain:</th><td>{voter.isRegistered ? "Yes" : "No"}</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export function loadAllVoters(voters) {
  if (!voters || voters.length === 0) {
    return <p style={{textAlign: "center", margin: "20px"}}>No voters are currently listed in the system.</p>;
  }
  return (
    <>
      <div className="container-item success" style={{ marginTop: "15px", marginBottom:"5px" }}>
        <center><strong>List of All System Voters</strong></center>
      </div>
      {voters.map((voter, index) => (
        <div className="container-list success" key={voter.address || index} style={{ margin: "10px 0", padding: "10px", border: "1px solid #d0e0d0", borderRadius: "5px"}}>
          <table>
            <tbody>
              <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Account:</th><td style={{wordBreak: "break-all"}}>{voter.address}</td></tr>
              <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Name:</th><td>{voter.name || 'N/A'}</td></tr>
              <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Phone:</th><td>{voter.phone || 'N/A'}</td></tr>
              <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Voted:</th><td>{voter.hasVoted ? "Yes" : "No"}</td></tr>
              <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Admin Verified:</th><td>{voter.isVerified ? "Yes" : "No"}</td></tr>
              <tr><th style={{textAlign: "left", paddingRight: "15px"}}>Registered:</th><td>{voter.isRegistered ? "Yes" : "No"}</td></tr>
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

export default RegistrationWrapper;