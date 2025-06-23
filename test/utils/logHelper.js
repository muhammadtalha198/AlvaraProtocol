const fs = require("fs");
const path = require("path");

// Holds the transaction logs
let transactionLog = [];

// Flag to determine if logging is enabled
let loggingEnabled = false;

// Create a new log file (initialize)
function createNewLogFile(network) {
  // If network is provided, check if it's not localhost or hardhat
  if (network) {
    loggingEnabled = network !== "localhost" && network !== "hardhat";
  }
  
  // Reset the transaction log array
  transactionLog = [];
  
}

// Log a new transaction entry with dynamic data
function log(action, data, network) {
  // If network is provided, check if it's not localhost or hardhat
  if (network) {
    loggingEnabled = network !== "localhost" && network !== "hardhat";
  }
  
  // Only log if logging is enabled
  if (!loggingEnabled) return;
  
  const logEntry = {
    action: action,
    data: data, // `data` is expected to be an object containing dynamic data
  };

  // Push the log entry to the transactionLog array
  transactionLog.push(logEntry);
}

// Save the log file with a timestamp in the filename
function saveLogFile(network) {
  // If network is provided, check if it's not localhost or hardhat
  if (network) {
    loggingEnabled = network !== "localhost" && network !== "hardhat";
  }
  
  // Only save if logging is enabled and there are logs
  if (!loggingEnabled || transactionLog.length === 0) return;
  // Create a filename-safe timestamp (replace colons with hyphens)
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  
  // Define the logs directory path
  const logDir = path.join(__dirname, "../logs");
  
  // Ensure the logs directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Create the full log file path
  const logFilePath = path.join(logDir, `test_logs_${timestamp}.json`);

  // Convert the log array to a JSON string and save it to a file
  fs.writeFileSync(logFilePath, JSON.stringify(transactionLog, null, 2), "utf-8");

  console.log(`Test Logs Saved >> '${logFilePath}'.`);
}

module.exports = {
  createNewLogFile,
  log,
  saveLogFile,
};
