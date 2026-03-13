import {
  CaretDown,
  MagnifyingGlass,
  PaperPlaneTilt,
  SpinnerGap,
} from "@phosphor-icons/react";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { contactFormSchema } from "~/lib/validations/contact";
import { countryCodes } from "~/lib/countryCodes";
import { isPossiblePhoneNumber } from "libphonenumber-js";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ContactFormDialogComponent({
  open,
  onOpenChange,
}: ContactFormDialogProps) {
  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [company, setCompany] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Country dropdown state
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const countrySearchInputRef = useRef<HTMLInputElement>(null);

  // Close country dropdown when clicking outside
  useEffect(() => {
    if (!countryDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        countryDropdownRef.current &&
        !countryDropdownRef.current.contains(e.target as Node)
      ) {
        setCountryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [countryDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (countryDropdownOpen) {
      setTimeout(() => countrySearchInputRef.current?.focus(), 50);
    } else {
      setCountrySearch("");
    }
  }, [countryDropdownOpen]);

  // Filtered countries
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countryCodes;
    const q = countrySearch.toLowerCase();
    return countryCodes.filter(
      (c) => c.country.toLowerCase().includes(q) || c.code.includes(q),
    );
  }, [countrySearch]);

  // Selected country display
  const selectedCountry = useMemo(
    () => countryCodes.find((c) => c.code === countryCode),
    [countryCode],
  );

  // Validate a single field on blur
  const validateField = useCallback(
    (fieldName: string, value: string) => {
      if (fieldName === "phone") {
        if (!value || value.length === 0) {
          setErrors((prev) => {
            const next = { ...prev };
            delete next.phone;
            return next;
          });
          return;
        }
        // Just check digits for now — full validation on submit
        if (!/^\d+$/.test(value)) {
          setErrors((prev) => ({ ...prev, phone: "Only digits allowed" }));
          return;
        }
        setErrors((prev) => {
          const next = { ...prev };
          delete next.phone;
          return next;
        });
        return;
      }

      const fieldSchema =
        contactFormSchema.shape[
          fieldName as keyof typeof contactFormSchema.shape
        ];
      if (!fieldSchema) return;

      try {
        fieldSchema.parse(value);
        setErrors((prev) => {
          const next = { ...prev };
          delete next[fieldName];
          return next;
        });
      } catch (error: any) {
        if (error.issues?.[0]) {
          setErrors((prev) => ({
            ...prev,
            [fieldName]: error.issues[0].message,
          }));
        }
      }
    },
    [countryCode],
  );

  // Reset form
  const resetForm = useCallback(() => {
    setFullName("");
    setEmail("");
    setPhone("");
    setCountryCode("+91");
    setCompany("");
    setSubject("");
    setMessage("");
    setErrors({});
    setSuccess(false);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    setErrors({});

    const validationResult = contactFormSchema.safeParse({
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      countryCode,
      company: company.trim(),
      subject: subject.trim(),
      message: message.trim(),
    });

    let hasErrors = false;
    const newErrors: Record<string, string> = {};

    if (!validationResult.success) {
      hasErrors = true;
      validationResult.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          newErrors[String(issue.path[0])] = issue.message;
        }
      });
    }

    // Validate phone with libphonenumber-js on submit
    if (phone.trim()) {
      try {
        const fullNumber = (countryCode + phone.trim()).replace(/\s/g, "");
        if (!isPossiblePhoneNumber(fullNumber)) {
          hasErrors = true;
          newErrors.phone =
            "Invalid phone number for the selected country";
        }
      } catch {
        hasErrors = true;
        newErrors.phone = "Invalid phone number format";
      }
    }

    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validationResult.data),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 2000);
    } catch (err) {
      console.error("Error sending contact message:", err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to send message. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }, [
    fullName,
    email,
    phone,
    countryCode,
    company,
    subject,
    message,
    onOpenChange,
    resetForm,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="bg-[#1a1a1a] border-white/10 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {success ? (
          <div className="py-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-4xl">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Message Sent!
                </h3>
                <p className="text-white/60 text-sm">
                  We'll get back to you as soon as possible.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-white text-2xl font-bold">
                Send Us a Message
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* Full Name */}
              <div>
                <Label htmlFor="contact-fullname" className="text-white/70">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contact-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={(e) =>
                    validateField("fullName", e.target.value.trim())
                  }
                  placeholder="John Doe"
                  className={cn(
                    "mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40",
                    errors.fullName && "border-red-500/50",
                  )}
                  autoFocus
                />
                {errors.fullName && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.fullName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="contact-email" className="text-white/70">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={(e) =>
                    validateField("email", e.target.value.trim())
                  }
                  placeholder="user@example.com"
                  className={cn(
                    "mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40",
                    errors.email && "border-red-500/50",
                  )}
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                )}
              </div>

              {/* Phone with country selector */}
              <div>
                <Label htmlFor="contact-phone" className="text-white/70">
                  Phone Number
                </Label>
                <div className="mt-2 flex gap-2">
                  {/* Custom country dropdown (no Radix portal) */}
                  <div className="relative" ref={countryDropdownRef}>
                    <button
                      type="button"
                      onClick={() =>
                        setCountryDropdownOpen((prev) => !prev)
                      }
                      className="flex items-center justify-between w-[140px] h-9 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 hover:bg-white/10 transition-colors"
                    >
                      <span className="truncate">
                        {selectedCountry
                          ? `${selectedCountry.flag} ${selectedCountry.code}`
                          : countryCode}
                      </span>
                      <CaretDown className="w-3 h-3 text-white/50 shrink-0 ml-1" />
                    </button>

                    {countryDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-[280px] bg-[#222] border border-white/10 rounded-lg shadow-2xl z-[200] overflow-hidden">
                        {/* Search */}
                        <div className="p-2 border-b border-white/10 relative">
                          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                          <input
                            ref={countrySearchInputRef}
                            className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                            placeholder="Search countries..."
                            value={countrySearch}
                            onChange={(e) =>
                              setCountrySearch(e.target.value)
                            }
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>
                        {/* List */}
                        <div className="max-h-[240px] overflow-y-auto">
                          <div className="p-1">
                            {filteredCountries.map((country) => (
                              <button
                                key={`${country.code}-${country.country}`}
                                type="button"
                                onClick={() => {
                                  setCountryCode(country.code);
                                  setCountryDropdownOpen(false);
                                  // Clear phone error on country change
                                  setErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.phone;
                                    return next;
                                  });
                                }}
                                className={cn(
                                  "flex items-center gap-2 w-full px-2.5 py-2 rounded-md text-sm text-white/90 hover:bg-white/10 transition-colors cursor-pointer text-left",
                                  country.code === countryCode &&
                                    "bg-purple-500/20 text-white",
                                )}
                              >
                                <span>{country.flag}</span>
                                <span className="flex-1 truncate">
                                  {country.country}
                                </span>
                                <span className="text-white/50 text-xs">
                                  {country.code}
                                </span>
                              </button>
                            ))}
                            {filteredCountries.length === 0 && (
                              <div className="px-3 py-4 text-sm text-white/40 text-center">
                                No countries found
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    id="contact-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "");
                      const limited = digitsOnly.slice(0, 15);
                      setPhone(limited);
                      if (!limited) {
                        setErrors((prev) => {
                          const next = { ...prev };
                          delete next.phone;
                          return next;
                        });
                      }
                    }}
                    onBlur={(e) =>
                      validateField("phone", e.target.value.trim())
                    }
                    placeholder="e.g. 501234567"
                    className={cn(
                      "flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40",
                      errors.phone && "border-red-500/50",
                    )}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                )}
              </div>

              {/* Company */}
              <div>
                <Label htmlFor="contact-company" className="text-white/70">
                  Company / Organization
                </Label>
                <Input
                  id="contact-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Your Company"
                  className="mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
              </div>

              {/* Subject */}
              <div>
                <Label htmlFor="contact-subject" className="text-white/70">
                  Subject <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  onBlur={(e) =>
                    validateField("subject", e.target.value.trim())
                  }
                  placeholder="e.g., Technical Support, Billing Question, Feature Request"
                  className={cn(
                    "mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40",
                    errors.subject && "border-red-500/50",
                  )}
                />
                {errors.subject && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.subject}
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <Label htmlFor="contact-message" className="text-white/70">
                  Message <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onBlur={(e) =>
                    validateField("message", e.target.value.trim())
                  }
                  placeholder="Tell us about your inquiry..."
                  className={cn(
                    "mt-2 bg-white/5 border-white/10 text-white placeholder:text-white/40 min-h-[120px]",
                    errors.message && "border-red-500/50",
                  )}
                />
                {errors.message && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  resetForm();
                }}
                disabled={isSending}
                className="border-white/10 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !fullName.trim() ||
                  !email.trim() ||
                  !subject.trim() ||
                  !message.trim() ||
                  isSending
                }
                className="bg-purple-500 hover:bg-purple-600 text-white"
              >
                {isSending ? (
                  <>
                    <SpinnerGap className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <PaperPlaneTilt className="w-4 h-4 mr-2" />
                    Send Message
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const ContactFormDialog = memo(ContactFormDialogComponent);
export default ContactFormDialog;
