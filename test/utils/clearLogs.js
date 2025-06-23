const fs = require('fs');
const path = require('path');

// Path to the logs directory
// Since the script is now in test/utils, we need to go up one level to find the logs directory
const logsDir = path.join(__dirname, '..', 'logs');

function clearLogs() {
  console.log('Checking for logs directory...');
  
  // Check if the logs directory exists
  if (!fs.existsSync(logsDir)) {
    console.log('Logs directory does not exist. Nothing to clear.');
    return;
  }
  
  console.log(`Found logs directory: ${logsDir}`);
  console.log('Clearing test logs...');
  
  // Read all files in the logs directory
  const files = fs.readdirSync(logsDir);
  
  if (files.length === 0) {
    console.log('No log files found. Directory is already empty.');
    return;
  }
  
  let deletedCount = 0;
  
  // Delete each file
  files.forEach(file => {
    const filePath = path.join(logsDir, file);
    
    // Check if it's a file (not a directory)
    if (fs.statSync(filePath).isFile()) {
      // Only delete JSON log files
      if (path.extname(file).toLowerCase() === '.json') {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Deleted: ${file}`);
      }
    }
  });
  
  console.log(`Successfully cleared ${deletedCount} log files.`);
}
