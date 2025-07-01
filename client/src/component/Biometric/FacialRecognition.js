// Node modules
import React, { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
// Import useHistory and useLocation for navigation and state access
import { useHistory, useLocation } from "react-router-dom";


function FacialRecognition({ onRecognized }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [referenceDescriptors, setReferenceDescriptors] = useState({});
  const [message, setMessage] = useState("");

  // Initialize history hook
  const history = useHistory();
  // Initialize location hook to access state
  const location = useLocation();
  // Get the redirect target from location state, default to 'registration'
  const redirectTo = location.state?.redirectTo || "registration";


  useEffect(() => {
    const loadModels = async () => {
      setMessage("Loading face recognition models...");
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      // Corrected potential copy-paste error, ensure correct models are loaded
      await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
      setLoading(false);
      setMessage("Models loaded. Ready to enroll/recognize.");
    };

    loadModels();

    // Request camera access after models are loaded
    // Adding a check for navigator.mediaDevices
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: {} })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            // Optionally, you can start streaming immediately if needed
            // videoRef.current.play();
          }
        })
        .catch((err) => {
          console.error("Camera error:", err);
          setMessage("Failed to access camera. Please check permissions.");
        });
    } else {
        setMessage("getUserMedia not supported on your browser!");
    }

    // Cleanup function to stop the camera stream when the component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };

  }, []); // Empty dependency array ensures this runs only once on mount


  // This function enrolls known faces. It fetches images and computes descriptors.
  const enrollFace = async (personName, imageUrl) => {
      setMessage(`Attempting to enroll ${personName}...`);
    try {
        const img = await faceapi.fetchImage(imageUrl);
        const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detection && detection.descriptor) { // Ensure descriptor is generated
          setReferenceDescriptors((prev) => ({ ...prev, [personName]: detection.descriptor }));
          setMessage((prev) => prev + `\n${personName} enrolled successfully.`);
        } else {
          setMessage((prev) => prev + `\nNo face detected or descriptor not generated in ${personName}'s image.`);
        }
    } catch (error) {
        console.error(`Error enrolling ${personName}:`, error);
        setMessage((prev) => prev + `\nError enrolling ${personName}.`);
    }
  };

  // Button handler to start the enrollment process for predefined faces.
  const handleEnroll = async () => {
    setMessage("Starting enrollment...");
    await enrollFace("Himanshu", "/known_faces/himanshu.jpg");
    await enrollFace("Harsh", "/known_faces/harsh.jpg");
    await enrollFace("Dr. Atul Mishra", "/known_faces/atul.jpg");
    setMessage((prev) => prev + "\nEnrollment complete. Ready for recognition.");
  };

  // Updated handleRecognize function to specifically verify against 'Himanshu'
  // and redirect based on the 'redirectTo' state
  const handleRecognize = async () => {
      setMessage("Attempting recognition...");
    // Ensure video element is ready
    if (!videoRef.current || videoRef.current.readyState < 2) { // Check readyState >= 2 (HAVE_CURRENT_DATA)
        setMessage("Video not ready. Please ensure camera is working and showing feed.");
        return;
    }

    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    // Check if a face is detected in the video feed
    if (!detection || !detection.descriptor) {
      setMessage("No face detected or descriptor not generated from video feed. Please try again.");
      return;
    }

    // Check if the reference descriptor for 'Himanshu' is available
    if (!referenceDescriptors.Himanshu) {
      setMessage("Reference face (Himanshu) not enrolled. Please enroll faces first.");
      return;
    }

    // Perform Euclidean distance comparison
    const liveDescriptor = detection.descriptor;
    const referenceDescriptorHimanshu = referenceDescriptors.Himanshu;

    const distance = faceapi.euclideanDistance(liveDescriptor, referenceDescriptorHimanshu);

    // Define a threshold for recognition (commonly 0.6)
    const recognitionThreshold = 0.6;

    setMessage(`Distance to Himanshu: ${distance.toFixed(2)}`); // Show distance

    if (distance < recognitionThreshold) {
      // Face matched Himanshu within the threshold
      setMessage(`Face verified ✅. Redirecting to ${redirectTo}...`); // Use dynamic redirect target in message

      // ✅ Save verification to localStorage
      localStorage.setItem("isFaceVerified", "true");

      // Delay redirection to allow user to read the success message
      setTimeout(() => {
        // Navigate to the determined path without passing state (since it's in localStorage)
        history.push(`/${redirectTo}`);
      }, 1500); // Wait 1.5 seconds
    } else {
      // Face did not match Himanshu
      setMessage("Face does not match Himanshu. Try again.");
      // You might want to give feedback on the distance if helpful
    }

    // The original onRecognized prop is not used in this new verification logic.
  };

  return (
    <div style={{ textAlign: "center", margin: "20px" }}>
      {loading ? (
        // Corrected the comment that caused the SyntaxError and kept the emoji in the string
        <p>Loading face recognition models... ⏳</p>
      ) : (
        // ✅ New Styled UI starts here, replacing the previous content
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "80vh", // Added minHeight for better layout on shorter screens
          backgroundColor: "#f9f9f9", // Added a subtle background color
          padding: "30px", // Added padding
          boxSizing: "border-box" // Ensure padding is included in element's total width and height
        }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline // Keep playsInline for better mobile compatibility
            width="640" // Increased video width
            height="480" // Increased video height
            style={{
              borderRadius: "16px", // Increased border-radius
              border: "4px solid #3498db", // Thicker, more prominent border
              boxShadow: "0 8px 20px rgba(0,0,0,0.2)", // More pronounced shadow
              marginBottom: "20px" // Add space below video
            }}
          />

          <div style={{
            display: "flex",
            gap: "20px", // Space between buttons
            flexWrap: "wrap", // Allow buttons to wrap on smaller screens
            justifyContent: "center", // Center buttons
            marginBottom: "20px" // Add space below buttons
          }}>
            <button
              onClick={handleEnroll}
              style={{
                padding: "14px 32px", // Increased padding
                backgroundColor: "#27ae60", // Green color for Enroll
                color: "white",
                fontSize: "18px", // Increased font size
                border: "none",
                borderRadius: "10px", // Increased border-radius
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)", // Added shadow
                transition: "background-color 0.3s ease", // Added transition for hover effect
                // You might want to add hover/active styles here using CSS or state
              }}
            >
              📷 Enroll Face
            </button>

            <button
              onClick={handleRecognize}
              style={{
                padding: "14px 32px", // Increased padding
                backgroundColor: "#2980b9", // Blue color for Recognize
                color: "white",
                fontSize: "18px", // Increased font size
                border: "none",
                borderRadius: "10px", // Increased border-radius
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)", // Added shadow
                 transition: "background-color 0.3s ease", // Added transition for hover effect
                 // You might want to add hover/active styles here using CSS or state
              }}
            >
              🔍 Recognize Face
            </button>
          </div>

          {message && (
            <p style={{
              fontSize: "18px",
              fontWeight: "500",
              // Dynamic color based on message content (checking for success indicator)
              color: message.includes("verified ✅") ? "#2ecc71" : "#e74c3c",
              backgroundColor: "#fff", // White background for message box
              padding: "10px 20px", // Padding around message
              borderRadius: "12px", // Rounded corners for message box
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)", // Subtle shadow for message box
              whiteSpace: "pre-line", // Keep whiteSpace style
              minHeight: "3em", // Keep minHeight style to prevent layout shifts
              textAlign: 'center' // Explicitly center message text if needed
            }}>
              {message}
            </p>
          )}
        </div>
        // ✅ New Styled UI ends here
      )}
    </div>
  );
}

export default FacialRecognition;