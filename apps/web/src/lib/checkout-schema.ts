import { z } from "zod";
import { isValidBdPhone } from "@amader/shared";

export const addressSchema = z.object({
  recipientName: z.string().min(1, "Full name is required"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .refine(isValidBdPhone, "Enter a valid Bangladeshi mobile number (e.g. 01712345678)"),
  alternativePhone: z
    .string()
    .optional()
    .refine((v) => !v || isValidBdPhone(v), "Enter a valid Bangladeshi mobile number (e.g. 01712345678)"),
  email: z.union([z.string().email("Invalid email"), z.literal("")]).optional(),
  // Not collected from the customer — every BD district belongs to exactly
  // one division, so the backend derives it from `district` instead.
  division: z.string().optional(),
  district: z.string().min(1, "Select a district"),
  area: z.string().min(1, "Thana/Area is required"),
  landmark: z.string().optional(),
  addressLine: z.string().min(1, "Address is required"),
  postCode: z.string().optional(),
});

// Same INFERRED TYPE as addressSchema (required strings stay required,
// optional stays optional) but with none of the rules. The checkout form
// always carries a shippingAddress object — the fields are rendered and
// filled for a physical cart and sit at their empty defaults for a
// digital-only one, which has nothing to ship — so the shape is fixed while
// the rules are conditional. Holding the rules out of the base object and
// re-applying addressSchema from superRefine below is what lets a
// digital-only cart skip them without changing CheckoutFormValues.
const laxAddressSchema = z.object({
  recipientName: z.string(),
  phone: z.string(),
  alternativePhone: z.string().optional(),
  email: z.string().optional(),
  division: z.string().optional(),
  district: z.string(),
  area: z.string(),
  landmark: z.string().optional(),
  addressLine: z.string(),
  postCode: z.string().optional(),
});

// A digital-only order has no OrderAddress to carry a name/email/phone (see
// CheckoutDto.createAccount on the backend), so this small "Your details"
// block is the only place those are collected on that path. Rules live in
// the superRefine below for the same reason as the address: they apply only
// when the cart is digital-only.
const contactSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
});

const baseCheckoutSchema = z.object({
  shippingAddress: laxAddressSchema,
  contact: contactSchema,
  billingSameAsShipping: z.boolean(),
  billingAddress: addressSchema.optional(),
  paymentProvider: z.enum(["COD", "BKASH", "NAGAD", "ROCKET", "UPAY", "SSLCOMMERZ", "BANK_TRANSFER"]),
  codOtpCode: z.string().optional(),
  giftVoucherCode: z.string().optional(),
  customerNote: z.string().optional(),
  agreedToTerms: z.boolean().refine((v) => v, "You must agree to the terms to continue"),
});

// codOtpEnabled comes from SiteInfoDto (Settings > Net Profit > SMS's
// "Require phone OTP verification for Cash on Delivery orders" toggle) — when
// an admin turns it off, COD orders should submit with no OTP step at all,
// not just skip the backend's own check while the form (and its "Verify your
// phone" popup, which only opens in reaction to this exact validation error)
// keeps demanding a code nothing can supply. Defaults to `true` (the
// historical always-required behavior) while the setting is still loading.
// `requireEmail` is true for an account with no phone number — i.e. a
// customer who registered from outside Bangladesh on their email alone
// (RegisterDto.phone is optional for exactly that reason). They can't be
// reached by SMS, so the email on the order is their ONLY channel for
// confirmation and delivery updates, and it stops being optional.
// Everyone else is unaffected: a BD customer with a phone still gets the
// historical optional-email behaviour.
// `digitalOnly` is true when every cart line is a digital product (the same
// rule the backend's isDigitalOnly() applies) — there is nothing to ship, so
// the address card is not rendered at all and its fields must not be
// validated. The "Your details" fields take their place, and the COD OTP
// step is skipped: it verifies a delivery phone for a parcel that does not
// exist, and the popup that collects the code is keyed on the shipping phone
// this path never collects.
export function makeCheckoutFormSchema(codOtpEnabled: boolean, requireEmail = false, digitalOnly = false) {
  return baseCheckoutSchema.superRefine((values, ctx) => {
    // The physical path's address rules, unchanged — same messages, same
    // field paths, so the form behaves exactly as it did before. They just
    // run from here instead of from the object schema.
    if (!digitalOnly) {
      const parsed = addressSchema.safeParse(values.shippingAddress);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: issue.message,
            path: ["shippingAddress", ...issue.path],
          });
        }
      }
    }

    if (digitalOnly) {
      if (!values.contact.firstName.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "First name is required", path: ["contact", "firstName"] });
      }
      if (!values.contact.lastName.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Last name is required", path: ["contact", "lastName"] });
      }
      // Required, not optional as it is on a physical order: the download
      // link is emailed, and it is the buyer's only copy if they never sign
      // back in.
      const email = values.contact.email.trim();
      if (!email) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Email is required — your download link goes here", path: ["contact", "email"] });
      } else if (!z.string().email().safeParse(email).success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid email", path: ["contact", "email"] });
      }
      // Optional — a buyer outside Bangladesh has no BD mobile, and the
      // email above is already a usable identifier for the account the
      // backend creates. Validated only when actually filled in.
      const phone = values.contact.phone.trim();
      if (phone && !isValidBdPhone(phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid Bangladeshi mobile number (e.g. 01712345678)",
          path: ["contact", "phone"],
        });
      }
    }

    if (!digitalOnly && codOtpEnabled && values.paymentProvider === "COD" && !values.codOtpCode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        // Deliberately says "the code sent to you" rather than naming the
        // phone: the COD code can now go by SMS or email depending on what
        // the customer picked in CodOtpPopup, so wording it as "your phone"
        // would be wrong half the time.
        message: "আপনাকে পাঠানো ওটিপি কোডটি দিয়ে যাচাই সম্পন্ন করুন।",
        path: ["codOtpCode"],
      });
    }
    if (!digitalOnly && requireEmail && !values.shippingAddress.email?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required — we'll send order updates here since your account has no mobile number",
        path: ["shippingAddress", "email"],
      });
    }
    // Digital-only never renders the billing card (nothing is shipped, so
    // there is no "same as shipping" to differ from) and billingSameAsShipping
    // stays at its `true` default there.
    if (!digitalOnly && !values.billingSameAsShipping && !values.billingAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Billing address is required",
        path: ["billingAddress"],
      });
    }
  });
}

export type CheckoutFormValues = z.infer<typeof baseCheckoutSchema>;
export type AddressFormValues = z.infer<typeof addressSchema>;
