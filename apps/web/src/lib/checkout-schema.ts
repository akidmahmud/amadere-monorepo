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
export function makeCheckoutFormSchema(codOtpEnabled: boolean) {
  return baseCheckoutSchema.superRefine((values, ctx) => {
    if (codOtpEnabled && values.paymentProvider === "COD" && !values.codOtpCode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Verify your phone with the OTP sent to it",
        path: ["codOtpCode"],
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
