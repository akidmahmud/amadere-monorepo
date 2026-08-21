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

const baseCheckoutSchema = z.object({
  shippingAddress: addressSchema,
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
export function makeCheckoutFormSchema(codOtpEnabled: boolean, requireEmail = false) {
  return baseCheckoutSchema.superRefine((values, ctx) => {
    if (codOtpEnabled && values.paymentProvider === "COD" && !values.codOtpCode?.trim()) {
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
    if (requireEmail && !values.shippingAddress.email?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Email is required — we'll send order updates here since your account has no mobile number",
        path: ["shippingAddress", "email"],
      });
    }
    if (!values.billingSameAsShipping && !values.billingAddress) {
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
