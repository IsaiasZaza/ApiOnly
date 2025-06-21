const stripeMock = {
  checkout: {
    sessions: {
      create: jest.fn(),
    },
  },
};

module.exports = jest.fn(() => stripeMock);
