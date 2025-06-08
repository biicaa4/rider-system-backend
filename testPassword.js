const bcrypt = require("bcrypt");

// Test if password matches
async function test() {
  const password = "password";
  const hash = "$2b$10$Qk6dKRXb0eF8HgTZRBcEFuQBE5Y4vLs8QxkZvNfEMXNb5SaFBOFDe";

  const match = await bcrypt.compare(password, hash);
  console.log('Does "password" match the hash?', match);

  // Create new hash
  const newHash = await bcrypt.hash("password", 10);
  console.log('Fresh hash for "password":', newHash);
}

test();
