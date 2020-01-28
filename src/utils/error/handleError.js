const handleError = (error) => {
  if (error.message.includes('Invalid JSON RPC response: ""')) {
    throw new Error(`${error.message}. It looks like the ethereum node is not responding`);
  }

  if (error.message.includes('Returned values aren\'t valid, did it run Out of Gas?')) {
    throw new Error('Smart contract execution failed. Possible causes: Out of gas, no contract at given address, specified method doesn\'t exist on deployed contract.');
  }

  throw error;
};

module.exports = handleError;
