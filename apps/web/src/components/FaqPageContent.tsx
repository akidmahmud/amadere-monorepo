"use client";

import { useLocale } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";

// Pixel-perfect recreation of the approved FAQ mockup
// (amader-faq-pure-white-google-sans.html) — real bilingual content, not
// admin-authored CMS prose. Colors are the mockup's own one-off palette
// (deliberately distinct from the site's main --color-green brand accent —
// this page has its own visual identity by design), kept as local
// constants rather than added to the shared design tokens since nothing
// else on the site uses them.
const INK = "#20261D";
const INK_SOFT = "#5B6258";
const FOREST = "#3F5A35";
const TURMERIC = "#C9911F";
const CLAY = "#A84D2B";
const RULE = "#E3E6DF";
const STAMP = "#8E4030";

interface FaqItem {
  num: string;
  qBn: string;
  qEn: string;
  aBn: React.ReactNode;
  aEn: React.ReactNode;
}

interface FaqCategory {
  key: "shipping" | "payment" | "orders";
  labelBn: string;
  labelEn: string;
  items: FaqItem[];
}

// Content transcribed verbatim from the approved mockup — every question,
// answer, list item, and figure (delivery windows, charges, phone numbers)
// is the real copy, not placeholder text.
const CATEGORIES: FaqCategory[] = [
  {
    key: "shipping",
    labelBn: "শিপিং",
    labelEn: "Shipping",
    items: [
      {
        num: "01",
        qBn: "কী কী শিপিং পদ্ধতি রয়েছে?",
        qEn: "What Shipping Methods Are Available?",
        aBn: (
          <p>
            আমরা বিশ্বস্ত কুরিয়ার পার্টনার <strong>Steadfast Courier</strong>-এর মাধ্যমে সারা বাংলাদেশে হোম ডেলিভারি দিয়ে থাকি। দেশের
            যেকোনো প্রান্তে <strong>৩ কর্মদিবসের মধ্যে</strong> পণ্য পৌঁছে যায়। ডেলিভারি চার্জ <strong>ঢাকার ভেতরে ৳১০০</strong> এবং{" "}
            <strong>ঢাকার বাইরে ৳১৩০</strong>। সারাদেশে ক্যাশ অন ডেলিভারি (COD) সুবিধা রয়েছে, চাইলে bKash, Nagad, Rocket বা ব্যাংক
            ট্রান্সফারের মাধ্যমেও অগ্রিম পেমেন্ট করতে পারবেন।
          </p>
        ),
        aEn: (
          <p>
            We deliver all over Bangladesh right to your doorstep through our trusted courier partner, <strong>Steadfast Courier</strong>.
            Orders are delivered within <strong>3 working days</strong> anywhere in the country. Delivery charge is{" "}
            <strong>৳100 inside Dhaka</strong> and <strong>৳130 outside Dhaka</strong>. Cash on Delivery (COD) is available nationwide,
            and you can also pay in advance via bKash, Nagad, Rocket, or bank transfer.
          </p>
        ),
      },
      {
        num: "02",
        qBn: "আপনারা কি আন্তর্জাতিক শিপিং দেন?",
        qEn: "Do You Ship Internationally?",
        aBn: (
          <p>
            বর্তমানে আমরা <strong>শুধুমাত্র বাংলাদেশের ভেতরে</strong> ডেলিভারি দিয়ে থাকি। আন্তর্জাতিক শিপিং সুবিধা এখনো চালু হয়নি। তবে
            আপনি প্রবাসে থেকেও দেশে আপনার পরিবারের জন্য অর্ডার করতে পারবেন — অনলাইনে অর্ডার করে bKash, Nagad বা ব্যাংক ট্রান্সফারে পেমেন্ট
            করলেই আমরা দেশের যেকোনো ঠিকানায় পণ্য পৌঁছে দেব।
          </p>
        ),
        aEn: (
          <p>
            Currently, we deliver <strong>only within Bangladesh</strong>. We do not offer international shipping at this time. However,
            if you live abroad and want to send our natural products to your family in Bangladesh, you can easily place an order online
            and pay via bKash, Nagad, or bank transfer — we&apos;ll deliver it straight to their doorstep anywhere in the country.
          </p>
        ),
      },
      {
        num: "03",
        qBn: "পণ্য পেতে কতদিন সময় লাগবে?",
        qEn: "How Long Will It Take To Get My Package?",
        aBn: (
          <p>
            অর্ডার কনফার্ম হওয়ার পর বাংলাদেশের যেকোনো প্রান্তে <strong>৩ কর্মদিবসের মধ্যে</strong> আপনার পণ্য পৌঁছে যাবে। অর্ডার কনফার্মের
            পর আমরা যত্নসহকারে পণ্য প্যাকেজিং করে Steadfast কুরিয়ারের কাছে হস্তান্তর করি। ডেলিভারির আগে কুরিয়ার থেকে আপনাকে কল বা SMS
            করা হবে। জরুরি প্রয়োজনে WhatsApp-এ যোগাযোগ করলে আমরা দ্রুত ডেলিভারির চেষ্টা করব।
          </p>
        ),
        aEn: (
          <p>
            Your order will reach you within <strong>3 working days</strong> anywhere in Bangladesh. Once your order is confirmed, we
            carefully pack your products and hand them over to our courier partner, Steadfast. You&apos;ll receive a call or SMS from
            the courier before delivery. If you need your order urgently, contact us on WhatsApp and we&apos;ll do our best to
            prioritize it.
          </p>
        ),
      },
    ],
  },
  {
    key: "payment",
    labelBn: "পেমেন্ট",
    labelEn: "Payment",
    items: [
      {
        num: "04",
        qBn: "কী কী পেমেন্ট পদ্ধতি গ্রহণযোগ্য?",
        qEn: "What Payment Methods Are Accepted?",
        aBn: (
          <>
            <p>আমরা নিচের পেমেন্ট পদ্ধতিগুলো গ্রহণ করি:</p>
            <ul>
              <li>
                <strong>ক্যাশ অন ডেলিভারি (COD)</strong> — পণ্য হাতে পেয়ে পেমেন্ট করুন, সারাদেশে প্রযোজ্য
              </li>
              <li>
                <strong>bKash / Nagad / Rocket</strong> — আমাদের মার্চেন্ট নম্বরে মোবাইল পেমেন্ট
              </li>
              <li>
                <strong>ব্যাংক ট্রান্সফার</strong> — আমাদের কোম্পানি ব্যাংক অ্যাকাউন্টে সরাসরি ট্রান্সফার
              </li>
            </ul>
            <p>অগ্রিম পেমেন্টের ক্ষেত্রে ফোন বা WhatsApp-এ অর্ডার কনফার্মের সময় আমাদের টিম পেমেন্ট নম্বর/অ্যাকাউন্টের তথ্য জানিয়ে দেবে।</p>
          </>
        ),
        aEn: (
          <>
            <p>We accept the following payment methods:</p>
            <ul>
              <li>
                <strong>Cash on Delivery (COD)</strong> — pay when you receive your order, available nationwide
              </li>
              <li>
                <strong>bKash / Nagad / Rocket</strong> — mobile payment to our merchant number
              </li>
              <li>
                <strong>Bank Transfer</strong> — direct transfer to our company bank account
              </li>
            </ul>
            <p>For advance payments, our team will share the payment number/account details when confirming your order via phone or WhatsApp.</p>
          </>
        ),
      },
      {
        num: "05",
        qBn: "অনলাইনে কেনাকাটা কি নিরাপদ?",
        qEn: "Is Buying Online Safe?",
        aBn: (
          <>
            <p>অবশ্যই! Amader-এ কেনাকাটা ১০০% নিরাপদ ও ঝুঁকিমুক্ত। কেন নিশ্চিন্তে অর্ডার করতে পারেন:</p>
            <ul>
              <li>
                <strong>ক্যাশ অন ডেলিভারি</strong> — পণ্য হাতে পেয়ে তারপর পেমেন্ট করুন, টাকা হারানোর কোনো ঝুঁকি নেই
              </li>
              <li>
                <strong>রেজিস্টার্ড কোম্পানি</strong> — আমরা Amader eBuy Ltd., গাজীপুরে নিজস্ব অফিসসহ একটি নিবন্ধিত বাংলাদেশি কোম্পানি,
                এবং আমাদের পণ্য BSTI সার্টিফাইড
              </li>
              <li>
                <strong>৭ দিনের রিটার্ন গ্যারান্টি</strong> — কোনো কারণে সন্তুষ্ট না হলে ৭ দিনের মধ্যে যেকোনো পণ্য ফেরত দিয়ে সম্পূর্ণ
                রিফান্ড নিন
              </li>
              <li>
                <strong>রিয়েল সাপোর্ট টিম</strong> — কেনার আগে ও পরে ফোন, WhatsApp বা ইমেইলে যেকোনো সময় আমাদের সাথে যোগাযোগ করতে পারবেন
              </li>
            </ul>
            <p>২০২০ সাল থেকে সারা বাংলাদেশের হাজারো গ্রাহক আমাদের সাথে কেনাকাটা করছেন — আপনার আস্থাই আমাদের সবচেয়ে বড় সম্পদ।</p>
          </>
        ),
        aEn: (
          <>
            <p>Absolutely! Shopping with Amader is 100% safe and risk-free. Here&apos;s why you can order with complete confidence:</p>
            <ul>
              <li>
                <strong>Cash on Delivery</strong> — you can pay only after receiving your product, so there&apos;s zero risk of losing money
              </li>
              <li>
                <strong>Registered company</strong> — we are Amader eBuy Ltd., a registered Bangladeshi company with a physical office in
                Gazipur, and our products are BSTI certified
              </li>
              <li>
                <strong>7-day return guarantee</strong> — if you&apos;re not satisfied for any reason, return any product within 7 days
                for a full refund
              </li>
              <li>
                <strong>Real support team</strong> — you can reach us anytime by phone, WhatsApp, or email before and after your purchase
              </li>
            </ul>
            <p>Thousands of customers across Bangladesh have been shopping with us since 2020 — your trust is our biggest asset.</p>
          </>
        ),
      },
    ],
  },
  {
    key: "orders",
    labelBn: "অর্ডার ও রিটার্ন",
    labelEn: "Order & Returns",
    items: [
      {
        num: "06",
        qBn: "কীভাবে অর্ডার করব?",
        qEn: "How Do I Place an Order?",
        aBn: (
          <>
            <p>Amader-এ অর্ডার করা খুবই সহজ। আপনার সুবিধামতো যেকোনো মাধ্যমে অর্ডার করতে পারেন:</p>
            <ul>
              <li>
                <strong>ওয়েবসাইট:</strong> Amadere.com-এ গিয়ে পছন্দের পণ্য সিলেক্ট করুন, কার্টে যোগ করুন এবং নাম, ঠিকানা ও ফোন নম্বর
                দিয়ে চেকআউট সম্পন্ন করুন
              </li>
              <li>
                <strong>WhatsApp:</strong> পণ্যের নাম ও পরিমাণ মেসেজ করুন, আমাদের টিম অর্ডার কনফার্ম করে দেবে
              </li>
              <li>
                <strong>ফেসবুক পেজ:</strong> আমাদের ফেসবুক পেজে মেসেজ দিন — Messenger-এই আপনার অর্ডার নেওয়া হবে
              </li>
              <li>
                <strong>ফোন:</strong> সরাসরি +880 1615-980394 নম্বরে কল করে অর্ডার করুন
              </li>
            </ul>
            <p>অর্ডারের পর আমাদের টিম আপনাকে কল করে ঠিকানা ও ডেলিভারির বিষয়টি কনফার্ম করবে। এরপর নিশ্চিন্তে থাকুন — ৩ কর্মদিবসের মধ্যে আপনার প্রাকৃতিক পণ্য পৌঁছে যাবে আপনার দরজায়!</p>
          </>
        ),
        aEn: (
          <>
            <p>Ordering from Amader is quick and easy. You can order in whichever way is most convenient for you:</p>
            <ul>
              <li>
                <strong>Website:</strong> Visit Amadere.com, select your products, add them to the cart, and complete checkout with your
                name, address, and phone number
              </li>
              <li>
                <strong>WhatsApp:</strong> Message us the product name and quantity, and our team will confirm your order
              </li>
              <li>
                <strong>Facebook Page:</strong> Send us a message on our Facebook page — we&apos;ll take your order right in Messenger
              </li>
              <li>
                <strong>Phone:</strong> Call us directly at +880 1615-980394 and place your order over the phone
              </li>
            </ul>
            <p>After you order, our team will call you to confirm your address and delivery details. Then simply relax — your natural products will arrive at your doorstep within 3 working days!</p>
          </>
        ),
      },
      {
        num: "07",
        qBn: "অর্ডার বাতিল বা পরিবর্তন কীভাবে করব?",
        qEn: "How Can I Cancel or Change My Order?",
        aBn: (
          <>
            <p>
              পণ্য <strong>শিপমেন্টের আগে</strong> আপনি সহজেই অর্ডার বাতিল বা পরিবর্তন করতে পারবেন। যত দ্রুত সম্ভব ফোন (+880
              1615-980394), WhatsApp বা ফেসবুক Messenger-এ অর্ডার নম্বরসহ আমাদের জানান — পণ্য, পরিমাণ বা ডেলিভারি ঠিকানা যা-ই পরিবর্তন
              করতে চান।
            </p>
            <ul>
              <li>
                <strong>শিপমেন্টের আগে:</strong> অর্ডার বাতিল বা পরিবর্তন সম্পূর্ণ ফ্রি
              </li>
              <li>
                <strong>শিপমেন্টের পরে:</strong> অর্ডার আর পরিবর্তন করা সম্ভব নয়, তবে চিন্তার কিছু নেই — আপনার জন্য রয়েছে{" "}
                <strong>৭ দিনের রিটার্ন সুবিধা</strong>। প্রয়োজনে পণ্য গ্রহণ করে ফেরত দিয়ে সম্পূর্ণ রিফান্ড নিতে পারবেন
              </li>
            </ul>
            <p>অগ্রিম পেমেন্ট করে শিপমেন্টের আগে বাতিল করলে bKash, Nagad, ব্যাংক ট্রান্সফার বা আপনার পেমেন্টের মাধ্যমেই সম্পূর্ণ টাকা ফেরত দেওয়া হবে।</p>
          </>
        ),
        aEn: (
          <>
            <p>
              You can cancel or change your order easily <strong>before it has been shipped</strong>. Just contact us as soon as
              possible by phone (+880 1615-980394), WhatsApp, or Facebook Messenger with your order number and let us know what
              you&apos;d like to change — whether it&apos;s the product, quantity, or delivery address.
            </p>
            <ul>
              <li>
                <strong>Before shipping:</strong> Cancellation or changes are completely free
              </li>
              <li>
                <strong>After shipping:</strong> The order can no longer be changed, but don&apos;t worry — you&apos;re still covered by
                our <strong>7-day return policy</strong>. Simply receive the product and return it for a full refund if needed
              </li>
            </ul>
            <p>If you paid in advance and cancel before shipping, we&apos;ll refund the full amount via bKash, Nagad, bank transfer, or your original payment method.</p>
          </>
        ),
      },
      {
        num: "08",
        qBn: "অর্ডার করতে কি অ্যাকাউন্ট প্রয়োজন?",
        qEn: "Do I Need an Account to Place an Order?",
        aBn: (
          <>
            <p>
              না, অ্যাকাউন্টের কোনো প্রয়োজন নেই! আপনি <strong>গেস্ট হিসেবেই</strong> অর্ডার করতে পারবেন — চেকআউটে শুধু নাম, ফোন নম্বর ও
              ডেলিভারি ঠিকানা দিলেই অর্ডার সম্পন্ন হয়ে যাবে।
            </p>
            <p>তবে Amadere.com-এ ফ্রি অ্যাকাউন্ট খুললে কিছু বাড়তি সুবিধা পাবেন:</p>
            <ul>
              <li>চলমান অর্ডার ট্র্যাক করা ও আগের সব অর্ডারের হিসাব দেখা</li>
              <li>পরবর্তী কেনাকাটায় দ্রুত চেকআউট — ঠিকানা স্বয়ংক্রিয়ভাবে সেভ থাকবে</li>
              <li>নতুন পণ্য ও বিশেষ ডিসকাউন্টের খবর সবার আগে জানা</li>
            </ul>
            <p>আর মনে রাখবেন — অ্যাকাউন্ট ছাড়াও WhatsApp, ফেসবুক Messenger বা এক ফোন কলেই অর্ডার করা যায়।</p>
          </>
        ),
        aEn: (
          <>
            <p>
              No, you don&apos;t need an account! You can order as a <strong>guest</strong> — just provide your name, phone number, and
              delivery address at checkout, and your order will be placed instantly.
            </p>
            <p>However, creating a free account on Amadere.com gives you some nice benefits:</p>
            <ul>
              <li>Track your current orders and view your full order history</li>
              <li>Faster checkout next time — your address is saved automatically</li>
              <li>Be the first to know about new products and special discounts</li>
            </ul>
            <p>And remember — you can always order without any account at all through WhatsApp, Facebook Messenger, or a simple phone call.</p>
          </>
        ),
      },
      {
        num: "09",
        qBn: "অর্ডার কীভাবে ট্র্যাক করব?",
        qEn: "How Do I Track My Order?",
        aBn: (
          <>
            <p>অর্ডার ট্র্যাক করা খুবই সহজ! আপনার অর্ডার আমাদের কুরিয়ার পার্টনার <strong>Steadfast</strong>-এর কাছে হস্তান্তরের পর আপনি একটি SMS-এ ট্র্যাকিং/কনসাইনমেন্ট আইডি পাবেন। এরপর:</p>
            <ul>
              <li>
                <strong>অনলাইনে ট্র্যাক করুন:</strong> steadfast.com.bd-তে ট্র্যাকিং আইডি দিয়ে পার্সেলের সর্বশেষ অবস্থা দেখুন
              </li>
              <li>
                <strong>সরাসরি জিজ্ঞেস করুন:</strong> WhatsApp বা ফেসবুকে অর্ডার নম্বর দিয়ে মেসেজ করলেই আমাদের টিম সাথে সাথে ডেলিভারি
                স্ট্যাটাস জানিয়ে দেবে
              </li>
              <li>
                <strong>কুরিয়ার কল:</strong> ডেলিভারির আগে Steadfast-এর ডেলিভারি রাইডার আপনাকে কল করবে
              </li>
            </ul>
            <p>
              Amadere.com-এ অ্যাকাউন্ট থাকলে <strong>My Orders</strong> সেকশন থেকেও যেকোনো সময় অর্ডারের অবস্থা দেখতে পারবেন।
            </p>
          </>
        ),
        aEn: (
          <>
            <p>
              Tracking your order is easy! Once your order is handed over to our courier partner <strong>Steadfast</strong>, you&apos;ll
              receive an SMS with your tracking/consignment ID. You can then:
            </p>
            <ul>
              <li>
                <strong>Track online:</strong> Enter your tracking ID at steadfast.com.bd to see your parcel&apos;s live status
              </li>
              <li>
                <strong>Ask us directly:</strong> Message us on WhatsApp or Facebook with your order number, and our team will instantly
                update you on your delivery status
              </li>
              <li>
                <strong>Courier call:</strong> The Steadfast delivery rider will also call you before delivering your package
              </li>
            </ul>
            <p>
              If you have an account on Amadere.com, you can also check your order status anytime from the <strong>My Orders</strong>{" "}
              section.
            </p>
          </>
        ),
      },
      {
        num: "10",
        qBn: "পণ্য কীভাবে রিটার্ন করব?",
        qEn: "How Can I Return a Product?",
        aBn: (
          <>
            <p>
              পণ্য ফেরত দেওয়া খুবই সহজ। ডেলিভারির <strong>৭ দিনের মধ্যে যেকোনো পণ্য</strong> ফেরত দিতে পারবেন — কোনো প্রশ্ন ছাড়াই, এমনকি
              প্যাকেট খোলা থাকলেও। পদ্ধতি:
            </p>
            <ol>
              <li>
                <strong>যোগাযোগ করুন</strong> — ফোন, WhatsApp বা ফেসবুক Messenger-এ অর্ডার নম্বর ও পণ্যের নাম জানান
              </li>
              <li>
                <strong>আমাদের টিম</strong> রিটার্নের ঠিকানা ও নির্দেশনা কনফার্ম করবে
              </li>
              <li>
                <strong>কুরিয়ারে পণ্য পাঠিয়ে দিন</strong> (রিটার্ন ডেলিভারি চার্জ গ্রাহক বহন করবেন)
              </li>
              <li>
                <strong>সম্পূর্ণ রিফান্ড পাবেন</strong> — পণ্য পৌঁছানোর ৩–৫ কর্মদিবসের মধ্যে, bKash, Nagad, Rocket, ব্যাংক ট্রান্সফার বা
                ক্যাশ/COD সমন্বয়ে
              </li>
            </ol>
            <p>
              রিফান্ডের বদলে চাইলে একই মূল্যের অন্য পণ্যের সাথে <strong>এক্সচেঞ্জও</strong> করতে পারবেন। বিস্তারিত জানতে দেখুন আমাদের{" "}
              <Link href="/refund-policy" style={{ color: CLAY }} className="underline underline-offset-2">
                রিটার্ন ও এক্সচেঞ্জ নীতিমালা
              </Link>{" "}
              পেজ।
            </p>
          </>
        ),
        aEn: (
          <>
            <p>
              Returning a product is simple. You can return <strong>any product within 7 days</strong> of delivery — no questions
              asked, even if the packet has been opened. Here&apos;s how:
            </p>
            <ol>
              <li>
                <strong>Contact us</strong> by phone, WhatsApp, or Facebook Messenger with your order number and the product name
              </li>
              <li>
                <strong>Our team will confirm</strong> the return address and instructions
              </li>
              <li>
                <strong>Send the product back</strong> via courier (return delivery charge is borne by the customer)
              </li>
              <li>
                <strong>Get your full refund</strong> within 3–5 business days of us receiving the product — via bKash, Nagad, Rocket,
                bank transfer, or cash/COD adjustment
              </li>
            </ol>
            <p>
              You can also <strong>exchange</strong> the product for another of equal value instead of a refund. For full details, see
              our{" "}
              <Link href="/refund-policy" style={{ color: CLAY }} className="underline underline-offset-2">
                Returns &amp; Exchanges Policy
              </Link>{" "}
              page.
            </p>
          </>
        ),
      },
    ],
  },
];

const STAMPS: { bn: string; en: string; tilt: number }[] = [
  { bn: "৩ কর্মদিবসে ডেলিভারি", en: "Delivery in 3 Working Days", tilt: -4 },
  { bn: "সারাদেশে ক্যাশ অন ডেলিভারি", en: "Cash on Delivery Nationwide", tilt: 3 },
  { bn: "৭ দিনের রিটার্ন গ্যারান্টি", en: "7-Day Return Guarantee", tilt: -2 },
  { bn: "BSTI সার্টিফাইড রেজিস্টার্ড কোম্পানি", en: "BSTI Certified Registered Company", tilt: 4 },
];

type CategoryFilter = "all" | FaqCategory["key"];

export function FaqPageContent() {
  const locale = useLocale();
  const isBn = locale === "bn";
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  return (
    <div className="bg-white" style={{ color: INK }}>
      {/* The mockup's own bn/en pill used to sit here — removed per explicit
          request, since the site header already has a language switcher and
          two on one page is redundant. The page still renders bilingually
          off `useLocale()`; only the duplicate control is gone. */}

      {/* ===== Hero ===== */}
      <section className="mx-auto max-w-[960px] px-6 pt-9 pb-10 text-center">
        <div className="mb-3.5 text-[11px] font-semibold tracking-[0.22em] uppercase" style={{ color: CLAY }}>
          {isBn ? "আপনার প্রশ্ন, আমাদের উত্তর" : "Your Questions, Our Answers"}
        </div>
        <h1 className="mb-3.5 text-[30px] leading-tight font-bold sm:text-[46px]" style={{ color: FOREST, letterSpacing: "-0.01em" }}>
          {isBn ? "সচরাচর জিজ্ঞাসা" : "Frequently Asked Questions"}
        </h1>
        <p className="mx-auto max-w-[520px] text-base leading-[1.7]" style={{ color: INK_SOFT }}>
          {isBn
            ? "শিপিং, পেমেন্ট, অর্ডার ও রিটার্ন সম্পর্কিত সব প্রশ্নের উত্তর এক জায়গায় — যাতে নিশ্চিন্তে কেনাকাটা করতে পারেন Amader™-এর সাথে।"
            : "Everything about shipping, payment, ordering, and returns — so you can shop with Amader™ with complete peace of mind."}
        </p>
      </section>

      {/* ===== Trust stamps ===== */}
      <div className="mx-auto flex max-w-[900px] flex-wrap justify-center gap-[18px] px-6">
        {STAMPS.map((s, i) => (
          <div
            key={i}
            className="relative flex h-[118px] w-[118px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed p-2.5 text-center"
            style={{ borderColor: STAMP, transform: `rotate(${s.tilt}deg)` }}
          >
            <div className="absolute rounded-full border opacity-55" style={{ inset: "6px", borderColor: STAMP, borderWidth: 1 }} />
            <div className="relative text-[13px] leading-[1.35] font-bold" style={{ color: STAMP }}>
              {isBn ? s.bn : s.en}
            </div>
          </div>
        ))}
      </div>

      {/* ===== Category nav ===== */}
      <nav className="mx-auto mt-14 flex max-w-[760px] flex-wrap justify-center gap-2 px-6">
        {(["all", "shipping", "payment", "orders"] as CategoryFilter[]).map((key) => {
          const active = activeCategory === key;
          const label =
            key === "all"
              ? isBn
                ? "সব প্রশ্ন"
                : "All"
              : isBn
                ? CATEGORIES.find((c) => c.key === key)!.labelBn
                : CATEGORIES.find((c) => c.key === key)!.labelEn;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveCategory(key)}
              className="rounded-full border px-4.5 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-200"
              style={
                active
                  ? { background: FOREST, borderColor: FOREST, color: "#fff" }
                  : { background: "#fff", borderColor: RULE, color: INK_SOFT }
              }
            >
              {label}
            </button>
          );
        })}
      </nav>

      {/* ===== FAQ list ===== */}
      <main className="mx-auto max-w-[760px] px-6 pt-9 pb-24">
        {CATEGORIES.map((cat) => {
          if (activeCategory !== "all" && activeCategory !== cat.key) return null;
          return (
            <div key={cat.key} className="mb-1.5">
              <div
                className="mt-8 mb-1.5 flex items-center gap-3 text-[12px] font-semibold tracking-[0.18em] uppercase first:mt-0"
                style={{ color: FOREST }}
              >
                {isBn ? cat.labelBn : cat.labelEn}
                <span className="h-px flex-1" style={{ background: RULE }} />
              </div>

              {cat.items.map((item) => (
                <details key={item.num} className="group border-b" style={{ borderColor: RULE }} open={item.num === "01"}>
                  <summary className="flex list-none items-start justify-between gap-4 py-5 px-0.5 [&::-webkit-details-marker]:hidden">
                    <span className="mt-0.5 shrink-0 text-[12px] font-bold" style={{ color: TURMERIC }}>
                      {item.num}
                    </span>
                    <span className="flex-1 cursor-pointer text-[16.5px] font-semibold" style={{ color: INK }}>
                      {isBn ? item.qBn : item.qEn}
                    </span>
                    <span className="relative mt-0.5 h-[22px] w-[22px] shrink-0 cursor-pointer">
                      <span
                        className="absolute top-1/2 left-1/2 h-[2px] w-3.5 -translate-x-1/2 -translate-y-1/2"
                        style={{ background: FOREST }}
                      />
                      <span
                        className="absolute top-1/2 left-1/2 h-3.5 w-[2px] -translate-x-1/2 -translate-y-1/2 transition-transform duration-200 ease-in-out group-open:scale-y-0"
                        style={{ background: FOREST }}
                      />
                    </span>
                  </summary>
                  <div
                    className="max-w-[640px] px-0.5 pb-6 pl-[30px] text-[15px] leading-[1.85] [&_a]:text-[#A84D2B] [&_a]:underline [&_a]:underline-offset-2 [&_li]:mb-1.5 [&_ol]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p+p]:mt-3 [&_strong]:font-semibold [&_strong]:text-[#20261D] [&_ul]:my-2.5 [&_ul]:list-disc [&_ul]:pl-5"
                    style={{ color: INK_SOFT }}
                  >
                    {isBn ? item.aBn : item.aEn}
                  </div>
                </details>
              ))}
            </div>
          );
        })}
      </main>
    </div>
  );
}
