import { FooterConfig } from './footer.types';

// Mirrors what apps/web/src/components/SiteFooter.tsx hardcoded before this
// feature. Every getPublic() response is merged over this, so an empty or
// partially-filled footer_config row still renders a complete footer.
export const FOOTER_DEFAULTS: FooterConfig = {
  brandMark: { en: 'আমাদের', bn: 'আমাদের' },
  // Bengali on both locales, exactly as the site renders today. Writing
  // English copy here is the owner's content decision, not this task's.
  description: {
    en: 'Amader™ (আমাদের™) কেবল একটি ফুড ব্র্যান্ড নয়, এটি বিশুদ্ধতা, বিশ্বাস এবং যত্নের প্রতিশ্রুতি। Amader™ নিশ্চিত করে প্রতিটি পণ্য ১০০% বিশুদ্ধ, ন্যাচারাল এবং স্বাস্থ্যকর। আমাদের লক্ষ্য মানুষকে প্রাচীন ন্যাচারাল খাঁটি, স্বাস্থ্যকর খাবারের সাথে পুনরায় সংযুক্ত করে এমন একটি ভবিষ্যত তৈরি করা যেখানে স্বাস্থ্য, স্বাদ এবং প্রকৃতি মিলেমিশে বাস করে ওষুধ ছাড়া।',
    bn: 'Amader™ (আমাদের™) কেবল একটি ফুড ব্র্যান্ড নয়, এটি বিশুদ্ধতা, বিশ্বাস এবং যত্নের প্রতিশ্রুতি। Amader™ নিশ্চিত করে প্রতিটি পণ্য ১০০% বিশুদ্ধ, ন্যাচারাল এবং স্বাস্থ্যকর। আমাদের লক্ষ্য মানুষকে প্রাচীন ন্যাচারাল খাঁটি, স্বাস্থ্যকর খাবারের সাথে পুনরায় সংযুক্ত করে এমন একটি ভবিষ্যত তৈরি করা যেখানে স্বাস্থ্য, স্বাদ এবং প্রকৃতি মিলেমিশে বাস করে ওষুধ ছাড়া।',
  },
  contact: {
    address: {
      label: { en: 'Address:', bn: 'ঠিকানা:' },
      value: { en: 'Salna, Gazipur', bn: 'সালনা, গাজীপুর' },
    },
    phone: { label: { en: 'Call Us:', bn: 'কল করুন:' }, value: '+8801615980394' },
    email: { label: { en: 'Email:', bn: 'ইমেইল:' }, value: '' },
    hours: {
      label: { en: 'Working Hours:', bn: 'কর্মঘণ্টা:' },
      value: { en: '10am to 8pm', bn: 'সকাল ১০টা - রাত ৮টা' },
    },
  },
  social: [
    {
      icon: 'facebook',
      mediaId: null,
      url: 'https://www.facebook.com/amaderecommerce',
      label: { en: 'Facebook', bn: 'ফেসবুক' },
    },
    {
      icon: 'instagram',
      mediaId: null,
      url: 'https://www.instagram.com/amaderebuy',
      label: { en: 'Instagram', bn: 'ইনস্টাগ্রাম' },
    },
    {
      icon: 'youtube',
      mediaId: null,
      url: 'https://www.youtube.com/@amadere',
      label: { en: 'YouTube', bn: 'ইউটিউব' },
    },
  ],
  apps: {
    downloadLabel: { en: 'Download App on Mobile:', bn: 'মোবাইলে অ্যাপ ডাউনলোড করুন:' },
    buttons: [
      {
        style: 'googlePlay',
        mediaId: null,
        url: '',
        lineOne: { en: 'GET IT ON', bn: 'পাওয়া যাচ্ছে' },
        lineTwo: { en: 'Google Play', bn: 'Google Play' },
      },
      {
        style: 'appStore',
        mediaId: null,
        url: '',
        lineOne: { en: 'Download on the', bn: 'ডাউনলোড করুন' },
        lineTwo: { en: 'App Store', bn: 'App Store' },
      },
    ],
  },
  columns: [
    {
      heading: { en: 'About Amader™', bn: 'আমাদের™ সম্পর্কে' },
      links: [
        { label: { en: 'About Amader™', bn: 'আমাদের™ সম্পর্কে' }, href: '/about-us', newTab: false },
        { label: { en: 'Amader™ Brand', bn: 'আমাদের™ ব্র্যান্ড' }, href: '/amader-brand', newTab: false },
        { label: { en: 'Contact Amader™', bn: 'যোগাযোগ' }, href: '/contact', newTab: false },
        { label: { en: 'Amader™ Commitment', bn: 'আমাদের™ অঙ্গীকার' }, href: '/amader-commitment', newTab: false },
        { label: { en: 'Corporate Sales', bn: 'কর্পোরেট সেলস' }, href: '/corporate-sales', newTab: false },
        { label: { en: 'Amader™ Vision Mission', bn: 'আমাদের™ ভিশন ও মিশন' }, href: '/vision-mission', newTab: false },
        { label: { en: 'Frequently Asked Questions', bn: 'সচরাচর জিজ্ঞাসা' }, href: '/faq', newTab: false },
      ],
    },
    {
      heading: { en: 'Amader™ Policy', bn: 'আমাদের™ পলিসি' },
      links: [
        { label: { en: 'Terms & Conditions', bn: 'শর্তাবলী' }, href: '/terms-conditions', newTab: false },
        { label: { en: 'Privacy Policies', bn: 'গোপনীয়তা নীতি' }, href: '/privacy-policy', newTab: false },
        { label: { en: 'Returns & Exchanges', bn: 'রিটার্ন ও এক্সচেঞ্জ' }, href: '/refund-policy', newTab: false },
        { label: { en: 'Shipping & Delivery', bn: 'শিপিং ও ডেলিভারি' }, href: '/shipping-delivery', newTab: false },
        { label: { en: 'Workplace Policy', bn: 'কর্মক্ষেত্রের নীতি' }, href: '/workplace-policy', newTab: false },
        { label: { en: 'Health & Safety Policy', bn: 'স্বাস্থ্য ও নিরাপত্তা নীতি' }, href: '/health-safety-policy', newTab: false },
        { label: { en: 'Halal Business Commitment', bn: 'হালাল ব্যবসায়িক অঙ্গীকার' }, href: '/halal-commitment', newTab: false },
        { label: { en: 'Amader Commitment', bn: 'আমাদের অঙ্গীকার' }, href: '/amader-commitment', newTab: false },
        { label: { en: 'Cookie Policy', bn: 'কুকি নীতি' }, href: '/cookie-policy', newTab: false },
      ],
    },
    {
      heading: { en: 'Product Categories', bn: 'পণ্য বিভাগ' },
      links: [
        { label: { en: 'Amader Chatu', bn: 'আমাদের ছাতু' }, href: '/categories/amader-chatu', newTab: false },
        { label: { en: 'Amader Atta', bn: 'আমাদের আটা' }, href: '/categories/atta', newTab: false },
        { label: { en: 'Amader Oil', bn: 'আমাদের তেল' }, href: '/categories/amader-oil', newTab: false },
        { label: { en: 'Amader Modhu', bn: 'আমাদের মধু' }, href: '/categories/khati-modhu', newTab: false },
        { label: { en: 'Amader Herbs', bn: 'আমাদের হার্বস' }, href: '/categories/amader-herbs', newTab: false },
        { label: { en: 'Amader Super Food', bn: 'আমাদের সুপার ফুড' }, href: '/categories/amader-super-food', newTab: false },
        { label: { en: 'Amader Rice', bn: 'আমাদের চাল' }, href: '/categories/amader-rice', newTab: false },
        { label: { en: 'Amader Spices', bn: 'আমাদের মশলা' }, href: '/categories/amader-spices', newTab: false },
      ],
    },
  ],
  payment: { label: { en: 'Pay With', bn: 'পে উইথ' }, mediaId: null },
  copyright: {
    en: 'Copyright © {year} Amader Ltd. All rights reserved.',
    bn: 'কপিরাইট © {year} আমাদের লিমিটেড। সর্বস্বত্ব সংরক্ষিত।',
  },
  // Null on purpose: before this field existed the footer rendered the site
  // logo (site_logo_media_id), and the storefront still falls back to it.
  // Setting one here would override that for every install.
  logo: { mediaId: null },
};
