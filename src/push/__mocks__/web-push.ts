export const setVapidDetails = jest.fn();
export const sendNotification = jest.fn();
export const generateVAPIDKeys = jest.fn().mockReturnValue({
  publicKey: 'mock-public-key',
  privateKey: 'mock-private-key',
});
