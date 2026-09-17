# Accounts Module ব্যবহার নির্দেশিকা (বাংলা)

এই নির্দেশিকাটি Amader Admin-এর **Net Profit → Accounts** মডিউল ব্যবহারের জন্য। এখানে নগদ/ব্যাংক হিসাব, খরচ, পাওনা-দেনা, পার্টি, VAT, COD settlement এবং cash flow পরিচালনা করা যায়।

> **গুরুত্বপূর্ণ:** VAT, AIT, VDS এবং Mushak সংক্রান্ত হার বা রিপোর্ট চূড়ান্ত করার আগে প্রতিষ্ঠানের হিসাবরক্ষক বা VAT পরামর্শকের সঙ্গে মিলিয়ে নিন।

## ১. মডিউলে প্রবেশ

Admin panel থেকে:

1. **Net Profit** খুলুন।
2. **Accounts** নির্বাচন করুন।
3. উপরের **From** এবং **To** তারিখ দিয়ে রিপোর্টের সময়সীমা ঠিক করুন।

এই তারিখের সীমা Overview, Expenses, VAT, Cash Flow এবং export-এ প্রভাব ফেলে।

Accounts পেজে ছয়টি tab আছে:

| Tab | কাজ |
|---|---|
| Overview | বিক্রি, খরচ, পাওনা, দেনা ও cash balance-এর সারসংক্ষেপ |
| Expenses | খরচ লেখা, payment দেওয়া, edit/void এবং Excel export |
| Dues | Receivable, Payable এবং Party পরিচালনা |
| VAT & Cash Flow | VAT return, COD settlement, account cash flow ও period lock |
| VAT Exception | নির্দিষ্ট পণ্যের আলাদা VAT rate |
| Setup | Cash/Bank/Mobile Wallet account, category, cost centre ও settings |

## ২. প্রথমবারের সেটআপ

নতুনভাবে ব্যবহার শুরু করলে নিচের ক্রম অনুসরণ করুন।

### ধাপ ১: Cash/Bank/Mobile Wallet account তৈরি

পথ: **Net Profit → Accounts → Setup → Cash & bank accounts → + Add account**

ফর্মে:

- **Account name:** যেমন `Cash in Hand`, `BRAC Bank`, `bKash Merchant`।
- **Type:** Cash, Bank অথবা Mobile wallet।
- **Account / wallet number:** প্রয়োজন হলে account বা wallet number দিন।
- **Opening balance:** নির্ধারিত opening date-এ বাস্তবে যত টাকা ছিল।
- **Opening date:** opening balance যে তারিখের হিসাব।
- **Sort order:** তালিকায় কোনটি আগে দেখাবে। ছোট সংখ্যা আগে আসে।
- **Active:** নতুন payment-এ account-টি ব্যবহার করতে এটি চালু রাখুন।

সব তথ্য দিয়ে **Save account** চাপুন।

> Opening balance অনুমান করে দেবেন না। Bank statement, cash count বা wallet balance দেখে লিখুন। ভুল opening balance হলে পরবর্তী সব closing balance ভুল দেখাবে।

### ধাপ ২: Expense category তৈরি

পথ: **Setup → Expense categories → + Add category**

উদাহরণ:

- Office Rent
- Courier Expense
- Packaging
- Salary
- Marketing
- Utility Bill

**Input VAT is claimable** শুধু সেই category-তে চালু করুন যেখানে নিয়ম অনুযায়ী input VAT rebate দাবি করা যায়। Category আর ব্যবহার না করলে delete না করে Edit থেকে **Active** বন্ধ করুন; পুরোনো voucher অক্ষত থাকবে।

### ধাপ ৩: Cost centre তৈরি (ঐচ্ছিক)

পথ: **Setup → Cost centres → + Add cost centre**

Cost centre দিয়ে কোন unit বা department খরচ করেছে তা আলাদা করা যায়। যেমন:

- Head Office
- Warehouse
- Online Sales
- Uttara Branch

নাম, code, sort order ও active status দিয়ে **Save** করুন।

### ধাপ ৪: VAT ও COD fee settings

পথ: **Setup → VAT settings / COD fee settings**

VAT settings-এ:

- VAT accounting চালু/বন্ধ করুন।
- প্রতিষ্ঠানের default VAT rate লিখুন।
- Business BIN লিখুন।

COD fee settings-এ:

- COD fee চালু/বন্ধ করুন।
- প্রযোজ্য percentage লিখুন।

পরিবর্তনের পর সংশ্লিষ্ট **Save settings** button চাপুন।

### ধাপ ৫: Default posting account নির্বাচন

পথ: **VAT & Cash Flow → Posting account → Default cash account**

Prepaid sale এবং refund কোন account-এর ledger-এ যাবে সেটি এখানে নির্বাচন করুন। এটি না দিলে system অনুমান করে কোনো account-এ টাকা পোস্ট করবে না। তাই বিক্রি শুরু করার আগে সঠিক default account সেট করা জরুরি।

### ধাপ ৬: Party তৈরি

পথ: **Dues → Parties → + Add party**

Party হলো যেকোনো ব্যক্তি বা প্রতিষ্ঠান যার সঙ্গে টাকা-পাওনা/দেনা আছে।

- **Name:** ব্যক্তি বা প্রতিষ্ঠানের নাম।
- **Type:** Company অথবা Person।
- **Phone:** যোগাযোগের নম্বর।
- **BIN:** Supplier-এর input VAT claim করতে প্রয়োজন হতে পারে।
- **TIN:** প্রযোজ্য হলে লিখুন।
- **Courier provider:** Courier হলে provider নির্বাচন করুন।
- **Roles:** Supplier, Customer, Courier, Staff, Government বা Other—একাধিক role দেওয়া যায়।

একই ব্যক্তি/প্রতিষ্ঠানের জন্য আলাদা আলাদা duplicate party তৈরি করবেন না। একই party-এর একাধিক role দেওয়া যায়।

## ৩. Account balance কীভাবে কাজ করে

প্রতিটি cash/bank/mobile account-এর balance ledger থেকে হিসাব হয়:

**Closing balance = Opening balance + Money in − Money out**

যেসব কাজে balance বদলায়:

- Paid expense → নির্বাচিত account থেকে Money out
- Payable payment → নির্বাচিত account থেকে Money out
- Receivable collection → নির্বাচিত account-এ Money in
- COD settlement → নির্বাচিত account-এ Money in
- Account transfer → source account থেকে Money out এবং destination account-এ Money in
- Prepaid sale/refund → default posting account-এ সংশ্লিষ্ট entry

শুধু bill বা due তৈরি করলে account balance বদলায় না। আসল payment/receipt record করলেই cash movement হয়।

### Account ledger দেখা

পথ: **Setup → Cash & bank accounts → Ledger**

উপরের From/To তারিখ অনুযায়ী ledger-এ দেখা যাবে:

- Opening ও closing balance
- Entry date
- Source
- Reference
- Note
- Money in / Money out

### Account edit বা inactive করা

Account row-এর **Edit** চাপুন। পুরোনো history সংরক্ষণের জন্য ব্যবহৃত account delete না করে **Active** বন্ধ করুন। Inactive account নতুন payment selector-এ দেখাবে না, কিন্তু পুরোনো ledger থাকবে।

### Account-এর মধ্যে transfer

পথ: **Setup → Cash & bank accounts → Transfer**

1. **From** account নির্বাচন করুন।
2. **To** account নির্বাচন করুন।
3. Amount ও date দিন।
4. Bank/bKash reference এবং note থাকলে লিখুন।
5. **Record transfer** চাপুন।

একই account From ও To হিসেবে দেওয়া যাবে না। Transfer-কে expense বা income হিসেবে আবার লিখবেন না।

## ৪. Expense লেখা

পথ: **Accounts → Expenses → Record an expense**

### প্রয়োজনীয় তথ্য

- **Expense date:** খরচের তারিখ।
- **Category:** খরচের ধরন।
- **Cost centre:** কোন unit-এর খরচ—ঐচ্ছিক।
- **Payee:** Party list থেকে যাকে টাকা দেওয়া হচ্ছে।
- **Amount:** Bill amount।
- **VAT rate:** প্রযোজ্য VAT rate।
- **Amount already includes VAT:** দেওয়া amount-এর মধ্যেই VAT থাকলে tick করুন।
- **Mushak 6.3 challan no.:** input VAT claim-এর জন্য প্রযোজ্য হলে লিখুন।
- **AIT / source tax:** প্রযোজ্য source tax rate।
- **VAT deducted at source:** প্রযোজ্য VDS rate।
- **Payment status:** Paid now, Unpaid অথবা Partially paid।
- **Note:** খরচের উদ্দেশ্য।

Form-এর নিচে system Net amount, VAT, Gross bill, withheld amount এবং Net payable হিসাব করে দেখায়। যাচাই করে **+ Add expense** চাপুন।

### Payment status-এর অর্থ

#### Paid now

- সম্পূর্ণ টাকা এখনই দেওয়া হয়েছে।
- **Paid from account** নির্বাচন বাধ্যতামূলক।
- Save করলে সেই account থেকে টাকা কমবে।

#### Unpaid — send to Payables

- এখন কোনো টাকা দেওয়া হয়নি।
- Save করলে system স্বয়ংক্রিয়ভাবে Payable তৈরি করবে।
- একই bill আবার Dues-এ manually লিখবেন না।

#### Partially paid

- **Amount paid now** লিখুন।
- যে account থেকে দিয়েছেন সেটি নির্বাচন করুন।
- দেওয়া অংশ account থেকে কমবে এবং বাকি অংশ Payable হবে।

### Expense payment পরে দেওয়া

Expense register-এ unpaid/partial voucher-এর পাশে **Pay** চাপুন। Amount, payment date, account, reference ও note দিয়ে **Save payment** করুন। Payment outstanding amount-এর বেশি হতে পারবে না।

### Expense edit

**Edit** থেকে category, cost centre, Mushak challan, due date ও note পরিবর্তন করা যায়। Posting হয়ে যাওয়ার পর amount/VAT/financial totals edit করা যায় না। এগুলো ভুল হলে voucher **Void** করে সঠিকভাবে নতুন expense লিখুন।

### Expense void

**Void** delete নয়। এটি original voucher ও audit history রেখে reversing ledger entries তৈরি করে। ভুল voucher বাতিল করার জন্য Void ব্যবহার করুন।

### Filter ও export

Category, cost centre, status এবং search দিয়ে expense filter করা যায়। Filter করা ফল **Export Excel** দিয়ে export হবে।

## ৫. Dues: Receivable ও Payable

পথ: **Accounts → Dues**

- **Receivables — they owe us:** অন্যের কাছে আপনার পাওনা।
- **Payables — we owe them:** অন্যকে আপনার দেনা।
- **Parties:** ব্যক্তি/প্রতিষ্ঠান master list।

### Manual receivable কখন ব্যবহার করবেন

শুধু opening balance বা system-এর বাইরে হওয়া sale/লেনদেনের জন্য। Regular system sale নিজে আবার লিখবেন না।

### Manual payable কখন ব্যবহার করবেন

Opening balance, loan বা statutory due-এর জন্য। সাধারণ supplier bill প্রথমে Expenses-এ লিখুন; unpaid expense নিজে Payable তৈরি করে।

Manual due তৈরি করতে Party, Amount, Issue date, Due date ও Note দিয়ে **Add receivable/payable** চাপুন।

### টাকা গ্রহণ বা পরিশোধ

- Receivable row-তে **Receive** চাপলে account-এ Money in হবে।
- Payable row-তে **Pay** চাপলে account থেকে Money out হবে।
- Amount, payment date, account, reference ও note লিখুন।

Partial payment একাধিকবার করা যায়। Remaining zero হলে status Paid হবে।

### Due void

**Void** দিলে due এবং এর সঙ্গে থাকা payment entries reverse হবে। এটি করার আগে document number ও party নিশ্চিত করুন।

### Ageing

Ageing report বকেয়া কত দিনের তা bucket অনুযায়ী দেখায়। Overdue ও Average age দেখে collection/payment priority ঠিক করুন।

### Party statement

**Dues → Parties → Statement** থেকে একটি party-এর:

- They owe us
- We owe them
- Net position
- সম্পূর্ণ ledger entries

দেখা যায়। ভুল party information **Edit** করুন। **Deactivate** করলে নতুন entry-তে party পাওয়া যাবে না, কিন্তু পুরোনো history থাকবে।

## ৬. Overview বোঝা

Overview-এ নির্বাচিত date range অনুযায়ী দেখা যায়:

- **Sales:** সব channel-এর sales
- **Expenses:** VAT বাদে expense
- **Receivable:** অন্যের কাছে পাওনা
- **Payable:** অন্যকে দেনা
- **Cash in hand:** সব active/inactive account মিলিয়ে ledger balance
- **Where the money went:** category অনুযায়ী expense breakdown
- **Needs your attention:** missing configuration বা ঝুঁকির alert
- **Receivable/Payable ageing:** বকেয়ার বয়স

Overview-এর সংখ্যা অস্বাভাবিক হলে প্রথমে date range, account ledger, void entries এবং unpaid vouchers পরীক্ষা করুন।

## ৭. VAT & Cash Flow

### VAT summary

- **Output VAT:** customer-এর কাছ থেকে sales-এ নেওয়া VAT।
- **Input VAT claimable:** সঠিক challan ও supplier BIN থাকা claimable input VAT।
- **Net VAT to NBR:** output VAT থেকে eligible input VAT বাদ দেওয়ার পর হিসাব।
- **Withheld, not deposited:** AIT + VDS; এটি ব্যবসার নিজস্ব cash নয়।

### Input VAT at risk

এই তালিকায় সাধারণত দুই ধরনের সমস্যা দেখায়:

- Mushak 6.3 challan number নেই।
- Supplier party-তে BIN নেই।

Voucher number দেখে Expenses-এর **Edit** থেকে challan যোগ করুন অথবা Dues → Parties-এর **Edit** থেকে supplier BIN যোগ করুন।

### COD with courier settlement

Courier payout পাওয়ার পর:

1. সংশ্লিষ্ট courier row-তে **Settle** চাপুন।
2. Bank/wallet statement-এ আসা **Actual payout** লিখুন।
3. Settlement date দিন।
4. টাকা যে account-এ এসেছে সেটি নির্বাচন করুন।
5. Bank/bKash reference লিখুন।
6. Expected amount-এর সঙ্গে difference যাচাই করুন।
7. **Record settlement** চাপুন।

Difference থাকলে system adjustment হিসেবে record করবে, যাতে account balance বাস্তব bank statement-এর সঙ্গে মেলে। Courier-এর party mapping না থাকলে আগে Dues → Parties-এ courier party তৈরি বা ঠিক করুন।

### Cash flow by account

প্রতিটি account-এর Opening, Money in, Money out ও Closing দেখায়। **Export Excel** থেকে current date range-এর report পাওয়া যায়।

### Period lock

VAT return বা হিসাব final করার পর সংশ্লিষ্ট month নির্বাচন করে **Lock** করুন। Locked period-এ নতুন posting করা যাবে না। ভুল month lock হলে এবং অনুমোদন থাকলে **Unlock** করা যায়।

> Return file করার আগে lock করবেন না। আবার return file করার পর অযথা unlock করবেন না।

## ৮. VAT Exception

Store-এর default VAT rate থেকে আলাদা rate প্রয়োজন এমন product-এর জন্য এই tab ব্যবহার করুন।

1. Product name বা SKU দিয়ে search করুন।
2. Product নির্বাচন করুন।
3. VAT rate লিখুন।
4. **Add exception** চাপুন।

গুরুত্বপূর্ণ পার্থক্য:

- Rate `0%` দিলে product স্থায়ীভাবে zero-rated থাকবে।
- **Remove** করলে exception উঠে যাবে এবং product আবার store default VAT rate ব্যবহার করবে।

## ৯. প্রতিদিনের প্রস্তাবিত workflow

### দিনের শুরুতে

1. Bank, cash ও wallet opening/previous closing মিলিয়ে দেখুন।
2. Overview-এর alert পরীক্ষা করুন।
3. Overdue receivable/payable দেখুন।

### লেনদেনের সময়

1. প্রতিটি expense একবারই লিখুন।
2. Payment হলে সঠিক account নির্বাচন করুন।
3. Reference পাওয়া গেলে লিখুন।
4. VAT claim হলে challan number ও supplier BIN নিশ্চিত করুন।
5. Cash↔Bank বা Bank↔Wallet movement সবসময় Transfer দিয়ে লিখুন।

### দিনের শেষে

1. Cash account-এর closing balance cash count-এর সঙ্গে মিলান।
2. Bank/mobile wallet ledger statement-এর সঙ্গে মিলান।
3. Pending COD settlement দেখুন।
4. ভুল entry থাকলে delete নয়—প্রয়োজনে Void করুন।

### মাস শেষে

1. Expense register export করে voucher যাচাই করুন।
2. Input VAT at risk ঠিক করুন।
3. Receivable/Payable ageing review করুন।
4. Cash flow export ও bank reconciliation করুন।
5. VAT return final হওয়ার পর period lock করুন।

## ১০. সাধারণ ভুল ও সমাধান

### “No active accounts — add one in Setup”

**Setup → Cash & bank accounts → + Add account** থেকে account তৈরি করুন। Account থাকলে Edit করে **Active** চালু আছে কি না দেখুন।

### Paid from account-এ কিছু দেখা যাচ্ছে না

কোনো active account নেই। Setup-এ account তৈরি বা inactive account active করুন।

### Payee/Party পাওয়া যাচ্ছে না

**Dues → Parties → + Add party** থেকে party তৈরি করুন। আগে deactivate করা থাকলে duplicate না বানিয়ে প্রয়োজন অনুযায়ী existing record ঠিক করুন।

### Category পাওয়া যাচ্ছে না

**Setup → Expense categories**-এ category active আছে কি না দেখুন।

### Input VAT at risk দেখাচ্ছে

Expense-এ Mushak 6.3 challan এবং supplier party-তে BIN—দুটিই পরীক্ষা করুন। Category-তে input VAT claimable চালু আছে কি না দেখুন।

### Cash balance bank statement-এর সঙ্গে মিলছে না

1. সঠিক date range নিন।
2. Account ledger খুলুন।
3. Opening balance যাচাই করুন।
4. Missing payment/receipt/transfer খুঁজুন।
5. একই transaction expense ও transfer—দুইভাবে লেখা হয়েছে কি না দেখুন।

### Amount ভুল লেখা হয়েছে

Posted financial amount সরাসরি edit করবেন না। Voucher Void করে সঠিক entry নতুন করে লিখুন।

### Expense লিখে Payable দ্বিগুণ হয়েছে

Unpaid/partial expense নিজেই Payable তৈরি করে। একই bill Dues-এ manually আবার লেখা হলে duplicate হবে। Manual duplicate entry Void করুন।

### Prepaid sale ledger-এ যাচ্ছে না

**VAT & Cash Flow → Posting account**-এ default cash account সেট করা আছে কি না দেখুন।

### Locked month-এ entry হচ্ছে না

Period final থাকলে অন্য date ব্যবহার করা যাবে না; সঠিক হিসাবরক্ষণ date প্রয়োজন। Lock ভুল হলে দায়িত্বপ্রাপ্ত admin-এর অনুমোদনে Unlock করুন।

## ১১. নিয়ন্ত্রণ ও নিরাপত্তা নিয়ম

- প্রতিটি বাস্তব টাকা movement-এ সঠিক account দিন।
- একই transaction দুইবার লিখবেন না।
- পুরোনো history রাখতে delete-এর বদলে inactive বা void ব্যবহার করুন।
- Void করার আগে voucher/document number এবং amount যাচাই করুন।
- Opening balance এবং COD actual payout অবশ্যই statement দেখে লিখুন।
- Month lock/unlock শুধু অনুমোদিত হিসাবরক্ষণ দায়িত্বপ্রাপ্ত ব্যক্তি করবেন।
- VAT settings বা product exception বদলালে পরিবর্তনের কারণ নথিভুক্ত রাখুন।
- নিয়মিত Excel export ও bank reconciliation সংরক্ষণ করুন।

## ১২. দ্রুত রেফারেন্স

| কাজ | কোথায় যাবেন |
|---|---|
| নতুন cash/bank/wallet account | Accounts → Setup → Cash & bank accounts |
| Account ledger | Accounts → Setup → account row → Ledger |
| Account transfer | Accounts → Setup → Transfer |
| নতুন expense | Accounts → Expenses |
| Expense payment | Expenses → voucher row → Pay |
| পাওনা গ্রহণ | Dues → Receivables → Receive |
| দেনা পরিশোধ | Dues → Payables → Pay |
| নতুন party | Dues → Parties → Add party |
| Party statement | Dues → Parties → Statement |
| Default sale posting account | VAT & Cash Flow → Posting account |
| COD settlement | VAT & Cash Flow → COD with courier → Settle |
| VAT risk | VAT & Cash Flow → Input VAT at risk |
| Product-specific VAT | VAT Exception |
| Month close | VAT & Cash Flow → Locked periods |
| Category/Cost centre | Accounts → Setup |

