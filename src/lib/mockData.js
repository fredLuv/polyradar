export const mockMarkets = [
  {
    id: 'mock-btc-100k',
    slug: 'will-bitcoin-hit-100k-by-year-end',
    question: 'Will Bitcoin hit $100k by year-end?',
    active: true,
    closed: false,
    volume_num: 1580000,
    liquidity_num: 520000,
    clob_token_ids: ['483310433366128830000000000000001']
  },
  {
    id: 'mock-fed-cut',
    slug: 'will-the-fed-cut-rates-next-meeting',
    question: 'Will the Fed cut rates at the next meeting?',
    active: true,
    closed: false,
    volume_num: 910000,
    liquidity_num: 260000,
    clob_token_ids: ['483310433366128830000000000000002']
  },
  {
    id: 'mock-election',
    slug: 'candidate-a-wins-general-election',
    question: 'Will Candidate A win the general election?',
    active: true,
    closed: false,
    volume_num: 2140000,
    liquidity_num: 740000,
    clob_token_ids: ['483310433366128830000000000000003']
  }
];

export const mockDepth = {
  '483310433366128830000000000000001': { midpoint: 0.57, spread: 0.018 },
  '483310433366128830000000000000002': { midpoint: 0.44, spread: 0.026 },
  '483310433366128830000000000000003': { midpoint: 0.62, spread: 0.015 }
};
