import { z } from "zod";

export const addressSchema = z.object({
  recipientName: z.string().min(1, "Full name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z.union([z.string().email("Invalid email"), z.literal("")]).optional(),
  division: z.string().min(1, "Select a division"),
  district: z.string().min(1, "Select a district"),
  area: z.string().optional(),
  landmark: z.string().optional(),
  addressLine: z.string().min(1, "Address is required"),
  postCode: z.string().optional(),
});

export const checkoutFormSchema = z
  .object({
    shippingAddress: addressSchema,
    billingSameAsShipping: z.boolean(),
    billingAddress: addressSchema.optional(),
    paymentProvider: z.enum(["COD", "BKASH", "NAGAD", "ROCKET", "UPAY", "SSLCOMMERZ", "BANK_TRANSFER"]),
    codOtpCode: z.string().optional(),
    giftVoucherCode: z.string().optional(),
    customerNote: z.string().optional(),
    agreedToTerms: z.boolean().refine((v) => v, "You must agree to the terms to continue"),
  })
  .superRefine((values, ctx) => {
    if (values.paymentProvider === "COD" && !values.codOtpCode?.trim()) {
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

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
export type AddressFormValues = z.infer<typeof addressSchema>;
