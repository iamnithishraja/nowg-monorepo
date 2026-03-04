import { z } from "zod";

// Phone number validation - only digits, exactly 10
const phoneRegex = /^\d{10}$/;
const digitsOnlyRegex = /^\d+$/;

export const contactFormSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .max(100, "Full name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address (e.g., user@example.com)"),
  phone: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => {
      // Allow empty (optional field)
      if (!val || val.length === 0) return true;
      // Must contain only digits
      if (!digitsOnlyRegex.test(val)) return false;
      // Must be exactly 10 digits
      return phoneRegex.test(val);
    }, "Phone number must be exactly 10 digits (numbers only)")
    .optional()
    .or(z.literal("")),
  countryCode: z.string().optional(),
  company: z.string().max(100, "Company name is too long").optional(),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(200, "Subject is too long"),
  message: z
    .string()
    .min(1, "Message is required")
    .max(5000, "Message is too long"),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
