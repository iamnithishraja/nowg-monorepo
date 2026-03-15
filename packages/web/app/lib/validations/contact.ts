import { z } from "zod";

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
