// Node modules
import React, { Component } from "react";
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
      voterCount: 0,
      voterName: "",
      voterPhone: "",
      voterEmail: "",
      voters: [],
      currentVoter: {
        address: undefined,
        name: null,
        phone: null,
        email: null,
        hasVoted: false,
        isVerified: false,
        isRegistered: false,
      },
      isLoading: true,
      statusMessage: "",
      isFaceVerifiedByLocalStorage: false,
      // --- OTP Flow State ---
      emailOtp: "",
      phoneOtp: "",
      generatedEmailOtp: null,
      generatedPhoneOtp: null,
      emailOtpSent: false,
      phoneOtpSent: false,
    };
  }

  // Refreshing once and initial data load
  componentDidMount = async () => {
    this.updateFaceVerificationStatusFromLocalStorage();

    if (!window.location.hash) {
      window.location = window.location + "#loaded";
      window.location.reload();
      return;
    }
    await this.loadBlockchainData();
  };

  updateFaceVerificationStatusFromLocalStorage = () => {
    const faceVerifiedStatus = localStorage.getItem("isFaceVerified") === "true";
    this.setState({ isFaceVerifiedByLocalStorage: faceVerifiedStatus });
  };

  loadBlockchainData = async () => {
    this.setState({ isLoading: true, statusMessage: "Connecting to blockchain and loading data..." });
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();
      const account = accounts[0];
      const networkId = await web3.eth.net.getId();
      const deployedNetwork = Election.networks[networkId];
      const instance = new web3.eth.Contract(
        Election.abi,
        deployedNetwork.address
      );

      this.setState({ web3, ElectionInstance: instance, account });

      const admin = await instance.methods.getAdmin().call();
      if (account === admin) {
        this.setState({ isAdmin: true });
      }

      const start = await instance.methods.getStart().call();
      const end = await instance.methods.getEnd().call();
      this.setState({ isElStarted: start, isElEnded: end });

      const voterCount = await instance.methods.getTotalVoter().call();
      this.setState({ voterCount: Number(voterCount) });

      const fetchedVoters = [];
      for (let i = 0; i < voterCount; i++) {
        const voterAddress = await instance.methods.voters(i).call();
        const voterDetails = await instance.methods.voterDetails(voterAddress).call();
        fetchedVoters.push({
          address: voterDetails.voterAddress,
          name: voterDetails.name,
          email: voterDetails.email,
          phone: voterDetails.phone,
          hasVoted: voterDetails.hasVoted,
          isVerified: voterDetails.isVerified,
          isRegistered: voterDetails.isRegistered,
        });
      }
      this.setState({ voters: fetchedVoters });

      const currentVoterDetails = await instance.methods.voterDetails(account).call();
      this.setState({
        currentVoter: {
          address: currentVoterDetails.voterAddress,
          name: currentVoterDetails.name,
          email: currentVoterDetails.email,
          phone: currentVoterDetails.phone,
          hasVoted: currentVoterDetails.hasVoted,
          isVerified: currentVoterDetails.isVerified,
          isRegistered: currentVoterDetails.isRegistered,
        },
        isLoading: false,
        statusMessage: "Blockchain data loaded successfully.",
      });
    } catch (error) {
      this.setState({
        isLoading: false,
        statusMessage: `Error loading data: ${error.message}. Please check console and refresh.`,
        web3: null,
      });
    }
  };

  updateVoterName = (event) => this.setState({ voterName: event.target.value, statusMessage: "" });
  updateVoterPhone = (event) => this.setState({ voterPhone: event.target.value, statusMessage: "" });
  updateVoterEmail = (event) => this.setState({ voterEmail: event.target.value, statusMessage: "" });
  updateEmailOtp = (event) => this.setState({ emailOtp: event.target.value, statusMessage: "" });
  updatePhoneOtp = (event) => this.setState({ phoneOtp: event.target.value, statusMessage: "" });

  // Simulate sending OTP for email
  handleSendEmailOtp = () => {
    const { voterEmail } = this.state;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voterEmail)) {
      this.setState({ statusMessage: "Error: Please enter a valid email address." });
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.setState({ generatedEmailOtp: otp, emailOtpSent: true, statusMessage: "Email OTP sent." });
    alert(`[SIMULATION] Email OTP Sent to ${voterEmail}: ${otp}`);
  };

  // Simulate sending OTP for phone
  handleSendPhoneOtp = () => {
    const { voterPhone } = this.state;
    if (voterPhone.length !== 10 || !/^\d{10}$/.test(voterPhone)) {
      this.setState({ statusMessage: "Error: Please enter a valid 10-digit phone number." });
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    this.setState({ generatedPhoneOtp: otp, phoneOtpSent: true, statusMessage: "Phone OTP sent." });
    alert(`[SIMULATION] SMS OTP Sent to ${voterPhone}: ${otp}`);
  };

  registerAsVoter = async () => {
    this.setState({ isLoading: true, statusMessage: "Processing registration..." });

    const { ElectionInstance, voterName, voterEmail, voterPhone, emailOtp, phoneOtp, generatedEmailOtp, generatedPhoneOtp, account, currentVoter, isFaceVerifiedByLocalStorage } = this.state;

    if (!ElectionInstance) {
      this.setState({ isLoading: false, statusMessage: "Error: Contract not initialized. Please refresh." });
      return;
    }

    if (!voterName.trim() || !voterPhone.trim() || !voterEmail.trim() || !emailOtp.trim() || !phoneOtp.trim()) {
      this.setState({ isLoading: false, statusMessage: "Error: All fields including both OTPs are required." });
      return;
    }
    if (!currentVoter.isRegistered && !isFaceVerifiedByLocalStorage) {
      this.setState({ isLoading: false, statusMessage: "Error: Facial verification is required for new voter registration." });
      return;
    }
    if (emailOtp !== generatedEmailOtp) {
      this.setState({ isLoading: false, statusMessage: "Error: Email OTP is incorrect." });
      return;
    }
    if (phoneOtp !== generatedPhoneOtp) {
      this.setState({ isLoading: false, statusMessage: "Error: Phone OTP is incorrect." });
      return;
    }

    try {
      this.setState({ statusMessage: "OTPs verified. Registering on the blockchain..." });
      const receipt = await ElectionInstance.methods
        .registerAsVoter(voterName.trim(), voterEmail.trim(), voterPhone.trim())
        .send({ from: account, gas: 1500000 });

      if (receipt.status) {
        this.setState({ statusMessage: "Registration successful! Page will now reload." });
        alert("Registration Successful!");
        localStorage.removeItem("isFaceVerified");
        this.setState({ isFaceVerifiedByLocalStorage: false });
        window.location.reload();
      } else {
        this.setState({ isLoading: false, statusMessage: "Error: Registration transaction failed on the blockchain." });
      }
    } catch (error) {
      let userFriendlyMessage = `Registration failed: ${error.message}`;
      if (error.message.includes("User denied transaction signature")) {
        userFriendlyMessage = "Registration Canceled: You rejected the transaction in MetaMask.";
      }
      this.setState({ isLoading: false, statusMessage: userFriendlyMessage });
    }
  };

  render() {
    const { history } = this.props;
    const {
      web3,
      isAdmin,
      isElStarted,
      isElEnded,
      currentVoter,
      voterName,
      voterPhone,
      voterEmail,
      emailOtp,
      phoneOtp,
      emailOtpSent,
      phoneOtpSent,
      isLoading,
      statusMessage,
      isFaceVerifiedByLocalStorage,
    } = this.state;

    if (isLoading && !this.state.ElectionInstance) {
      return (
        <>
          {isAdmin ? <NavbarAdmin /> : <Navbar />}
          <center style={{ padding: "30px" }}><h2>Loading Application & Connecting to Blockchain...</h2><p>{statusMessage || "Please wait."}</p></center>
        </>
      );
    }
    if (!web3 && !isLoading) {
        return (
          <>
            {isAdmin ? <NavbarAdmin /> : <Navbar />}
            <center style={{ padding: "30px" }}><h2>Application Error</h2><p>{statusMessage || "Failed to load components."}</p><button onClick={() => window.location.reload()}>Refresh</button></center>
          </>
        );
    }
    if ((!isElStarted && !isElEnded) && !isLoading && this.state.ElectionInstance) {
      return (
        <>
          {isAdmin ? <NavbarAdmin /> : <Navbar />}
          <NotInit />
        </>
      );
    }

    const canSeeRegistrationFormArea = currentVoter.isRegistered || (!currentVoter.isRegistered && isFaceVerifiedByLocalStorage);
    const registrationAllowed = !currentVoter.isRegistered && !currentVoter.isVerified;

    return (
      <>
        {isAdmin ? <NavbarAdmin /> : <Navbar />}
        <div className="container-main-heading"><h2>Voter Registration</h2></div>

        {statusMessage && (
            <div className={`status-message ${statusMessage.toLowerCase().includes("error") ? 'error' : 'info'}`}>
                <p>{statusMessage}</p>
            </div>
        )}
        {isLoading && statusMessage && <div style={{textAlign: "center"}}><p><i>Please wait...</i></p></div>}

        <div className="container-item info"><p>Registered Voters: {this.state.voterCount}</p></div>

        <div className="container-main">
          {!canSeeRegistrationFormArea && !currentVoter.isRegistered ? (
            <div className="facial-prompt">
              <h3>Facial Verification Required</h3>
              <p>To register as a new voter, please complete facial verification first.</p>
              <button onClick={() => history.push("/facial", { redirectTo: "registration" })} disabled={isLoading}>Verify Face Now</button>
            </div>
          ) : (
            <div className="container-item">
              {currentVoter.isRegistered && (
                   <p className="verified-notice">Your registration is complete. Details cannot be updated.</p>
               )}
              {registrationAllowed && (
                   <form onSubmit={(e) => { e.preventDefault(); this.registerAsVoter(); }}>
                      <div className="div-li"><label className={"label-r"}>Account Address</label><input className={"input-r"} type="text" value={this.state.account || 'N/A'} readOnly /></div>
                      <div className="div-li"><label className={"label-r"}>Full Name <span style={{ color: "tomato" }}>*</span></label><input className={"input-r"} type="text" placeholder="e.g., Alex Voter" value={voterName} onChange={this.updateVoterName} required /></div>

                      <div className="div-li">
                          <label className={"label-r"}>Email Address <span style={{ color: "tomato" }}>*</span></label>
                          <div className="input-with-button">
                            <input className={"input-r"} type="email" placeholder="e.g., voter@example.com" value={voterEmail} onChange={this.updateVoterEmail} disabled={emailOtpSent} required />
                            <button type="button" className="btn-send-otp" onClick={this.handleSendEmailOtp} disabled={isLoading || emailOtpSent || !voterEmail.trim()}>
                                {emailOtpSent ? "Sent" : "Send OTP"}
                            </button>
                          </div>
                      </div>
                      {emailOtpSent && (
                        <div className="div-li"><label className={"label-r"}>Email OTP <span style={{ color: "tomato" }}>*</span></label><input className={"input-r"} type="text" placeholder="Enter 6-digit OTP from email" value={emailOtp} onChange={this.updateEmailOtp} required /></div>
                      )}

                      <div className="div-li">
                          <label className={"label-r"}>Phone Number (10 digits) <span style={{ color: "tomato" }}>*</span></label>
                          <div className="input-with-button">
                            <input className={"input-r"} type="tel" placeholder="e.g., 9876543210" value={voterPhone} onChange={this.updateVoterPhone} disabled={phoneOtpSent} required pattern="\d{10}" />
                            <button type="button" className="btn-send-otp" onClick={this.handleSendPhoneOtp} disabled={isLoading || phoneOtpSent || !voterPhone.trim()}>
                                {phoneOtpSent ? "Sent" : "Send OTP"}
                            </button>
                          </div>
                      </div>
                      {phoneOtpSent && (
                        <div className="div-li"><label className={"label-r"}>Phone OTP <span style={{ color: "tomato" }}>*</span></label><input className={"input-r"} type="text" placeholder="Enter 6-digit OTP from SMS" value={phoneOtp} onChange={this.updatePhoneOtp} required /></div>
                      )}

                      <p className="note"><span style={{ color: "tomato" }}>Important:</span> Ensure your details are correct before sending OTPs.</p>
                      <button type="submit" className="btn-add" disabled={isLoading || !voterName.trim() || !voterPhone.trim() || !voterEmail.trim() || !emailOtp.trim() || !phoneOtp.trim()}>
                          {isLoading ? "Processing..." : "Verify & Register"}
                      </button>
                   </form>
               )}
            </div>
          )}
        </div>

        <div className="container-main voter-info-display">{loadCurrentVoter(currentVoter, currentVoter.isRegistered)}</div>
        {isAdmin && <div className="container-main admin-panel">{loadAllVoters(this.state.voters, this.state.voterCount)}</div>}
      </>
    );
  }
}

export function loadCurrentVoter(voter, isRegistered) {
    return (
      <>
        <div className={`container-item ${isRegistered ? "success" : "attention"}`}><center><strong>Your Registration Status</strong></center></div>
        <div className={`container-list ${isRegistered ? "success" : "attention"}`}>
          <table><tbody>
            <tr><th>Account:</th><td>{voter.address || 'N/A'}</td></tr>
            <tr><th>Name:</th><td>{voter.name || 'N/A'}</td></tr>
            <tr><th>Email:</th><td>{voter.email || 'N/A'}</td></tr>
            <tr><th>Phone:</th><td>{voter.phone || 'N/A'}</td></tr>
            <tr><th>Voted:</th><td>{voter.hasVoted ? "Yes" : "No"}</td></tr>
            <tr><th>Verified:</th><td>{voter.isVerified ? "Yes" : "No"}</td></tr>
            <tr><th>Registered:</th><td>{voter.isRegistered ? "Yes" : "No"}</td></tr>
          </tbody></table>
        </div>
      </>
    );
}

export function loadAllVoters(voters, voterCount) {
  if (!voters || voters.length === 0) return <p style={{textAlign: "center"}}>No voters listed.</p>;
  return (
    <>
      <div className="container-item success"><center><strong>List of All Voters</strong></center></div>
      {voters.map((voter, index) => (
        <div className="container-list success" key={index}>
          <table><tbody>
            <tr><th>Account:</th><td>{voter.address}</td></tr>
            <tr><th>Name:</th><td>{voter.name}</td></tr>
            <tr><th>Email:</th><td>{voter.email}</td></tr>
            <tr><th>Phone:</th><td>{voter.phone}</td></tr>
            <tr><th>Voted:</th><td>{voter.hasVoted ? "Yes" : "No"}</td></tr>
            <tr><th>Verified:</th><td>{voter.isVerified ? "Yes" : "No"}</td></tr>
          </tbody></table>
        </div>
      ))}
    </>
  );
}

export default RegistrationWrapper;