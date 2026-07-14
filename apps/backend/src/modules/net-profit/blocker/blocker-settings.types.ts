// Flat, JSON-serializable settings shape for the Blocker Manager — stored
// under a handful of NetProfitSettingsService keys (blocker.rules,
// blocker.thresholds, ...) rather than the plugin's 40+ individual options.

export const RULE_KEYS = [
  'ipTracker',
  'processingCooldown',
  'bulkOrderBlocker',
  'courierSuccessRate',
  'phoneValidation',
  'duplicateOrder',
  'blacklistedEmailDomain',
  'minimumOrderAmount',
  'dailyOrderLimit',
  'newCustomerHighValue',
  'speedBotDetection',
  'proxyTorDetection',
] as const;

export type RuleKey = (typeof RULE_KEYS)[number];

export const RULE_LABELS: Record<RuleKey, string> = {
  ipTracker: 'IP Tracker',
  processingCooldown: 'Processing Order Cooldown',
  bulkOrderBlocker: 'Bulk Order Blocker',
  courierSuccessRate: 'Courier Success Rate Block',
  phoneValidation: 'Phone Number Validation',
  duplicateOrder: 'Duplicate Order Detection',
  blacklistedEmailDomain: 'Blacklisted Email Domain Block',
  minimumOrderAmount: 'Minimum Order Amount Block',
  dailyOrderLimit: 'Maximum Order Limit Per Day',
  newCustomerHighValue: 'New Customer High Value Block',
  speedBotDetection: 'Speed/Bot Detection',
  proxyTorDetection: 'Proxy/Tor Detection Block',
};

export const RULE_HINTS: Record<RuleKey, string> = {
  ipTracker: 'Blocks when the same IP places too many orders in a time window.',
  processingCooldown: 'Blocks a new order while a prior order from the same phone is still in flight.',
  bulkOrderBlocker: 'Blocks when Pending/On-Hold/Failed orders from the same phone pass a limit.',
  courierSuccessRate: 'Blocks phones whose courier delivery success rate is below the threshold.',
  phoneValidation: 'Requires a valid 11-digit Bangladeshi mobile number.',
  duplicateOrder: 'Blocks re-submitting the same cart from the same phone/email shortly after.',
  blacklistedEmailDomain: 'Blocks checkout from disposable/temporary email domains.',
  minimumOrderAmount: 'Blocks orders below a minimum cart value.',
  dailyOrderLimit: 'Limits how many orders one phone can place per day.',
  newCustomerHighValue: "Blocks a first-time customer's high-value order for manual review.",
  speedBotDetection: 'Blocks checkout submitted implausibly fast (bot/auto-submit).',
  proxyTorDetection: 'Blocks checkout from a detected VPN/proxy connection.',
};

export interface RuleConfig {
  enabled: boolean;
  durationMinutes: number; // 0 = use defaultDurationMinutes
  heading: string;
  sub: string;
  message: string; // '' = use the rule's computed reason text
}

export interface BlockerThresholds {
  ipTrackerMaxOrders: number;
  ipTrackerWindowMinutes: number;
  processingCooldownMinutes: number;
  bulkPendingLimit: number;
  bulkHoldLimit: number;
  bulkFailedLimit: number;
  bulkWindowMinutes: number;
  courierThresholdPercent: number;
  duplicateWindowMinutes: number;
  minOrderAmount: number;
  dailyOrderLimit: number;
  highValueAmount: number;
  speedSeconds: number;
  blacklistedDomains: string[];
}

export interface BlockerPopupContact {
  defaultHeading: string;
  defaultSub: string;
  callEnabled: boolean;
  callNumber: string;
  whatsappEnabled: boolean;
  whatsappNumber: string;
  emailEnabled: boolean;
  emailAddress: string;
}

export interface BlockerSettings {
  enabled: boolean;
  showReasonInPopup: boolean;
  defaultDurationMinutes: number;
  manual: { heading: string; sub: string; message: string };
  rules: Record<RuleKey, RuleConfig>;
  thresholds: BlockerThresholds;
  popup: BlockerPopupContact;
}

const defaultRuleConfig = (heading: string, sub: string): RuleConfig => ({
  enabled: false,
  durationMinutes: 0,
  heading,
  sub,
  message: '',
});

export const BLOCKER_SETTINGS_DEFAULTS: BlockerSettings = {
  enabled: true,
  showReasonInPopup: true,
  defaultDurationMinutes: 1440,
  manual: {
    heading: 'We could not accept this order',
    sub: "Don't worry, we can sort this out",
    message: '',
  },
  rules: {
    ipTracker: defaultRuleConfig('Please wait a moment', "You'll be able to order again shortly"),
    processingCooldown: defaultRuleConfig('Your last order is still processing', 'You can order again once it completes'),
    bulkOrderBlocker: defaultRuleConfig('We could not accept this order', "Don't worry, we can sort this out"),
    courierSuccessRate: defaultRuleConfig('We could not accept this order', "Don't worry, we can sort this out"),
    phoneValidation: defaultRuleConfig('Please check your phone number', 'Something looks off with the number entered'),
    duplicateOrder: defaultRuleConfig('Have you already placed this order?', 'This may be a duplicate submission'),
    blacklistedEmailDomain: defaultRuleConfig('Please use a different email', 'Try your personal Gmail, Yahoo, etc.'),
    minimumOrderAmount: defaultRuleConfig('Please add a bit more to your cart', 'Minimum order amount not met'),
    dailyOrderLimit: defaultRuleConfig("You've reached today's order limit", 'You can order again tomorrow'),
    newCustomerHighValue: defaultRuleConfig('We could not accept this order', "Don't worry, we can sort this out"),
    speedBotDetection: defaultRuleConfig('We could not accept this order', 'Please take a moment and try again'),
    proxyTorDetection: defaultRuleConfig('We could not accept this order', 'Try switching networks and retry'),
  },
  thresholds: {
    ipTrackerMaxOrders: 5,
    ipTrackerWindowMinutes: 1440,
    processingCooldownMinutes: 60,
    bulkPendingLimit: 3,
    bulkHoldLimit: 3,
    bulkFailedLimit: 3,
    bulkWindowMinutes: 1440,
    courierThresholdPercent: 80,
    duplicateWindowMinutes: 60,
    minOrderAmount: 1,
    dailyOrderLimit: 5,
    highValueAmount: 5000,
    speedSeconds: 8,
    blacklistedDomains: ['mailinator.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com'],
  },
  popup: {
    defaultHeading: 'We could not accept this order right now',
    defaultSub: 'Please reach out to our support team',
    callEnabled: false,
    callNumber: '',
    whatsappEnabled: false,
    whatsappNumber: '',
    emailEnabled: false,
    emailAddress: '',
  },
};
