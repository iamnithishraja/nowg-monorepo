import Background from "../components/Background";
import GlowEffects from "../components/GlowEffects";
import { Header } from "../components";
import { Link } from "react-router";

export default function PrivacyPolicy() {
	return (
		<div className="min-h-screen relative text-foreground">
			<Background />
			<GlowEffects />
			<div className="relative z-10 flex min-h-screen flex-col">
				<Header showAuthButtons={true} showSidebarToggle={false} />
				<main className="flex-1">
					<div className="mx-auto max-w-4xl px-6 md:px-8 py-8 md:py-12">
						<div className="relative rounded-3xl border border-border/60 bg-background/70 backdrop-blur-2xl shadow-2xl shadow-black/30">
							<div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-white/15 via-white/5 to-transparent blur-[1px]" />
							<div className="relative p-6 md:p-10">
								<header className="mb-6 md:mb-8">
									<h1 className="text-3xl md:text-4xl font-semibold tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
										Privacy Policy
									</h1>
									<p className="mt-2 text-sm text-muted-foreground">
										Effective date: 03 Dec 2025 • Company: Aqylon Nexus Limited
									</p>
								</header>

								<nav className="mb-8 md:mb-10">
									<ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#intro">1. Introduction and Scope</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#controller">2. Data Controller & Contact</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#types">3. Types of Data</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#sources">4. Sources of Data</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#legal">5. Legal Basis & Purposes</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#cookies">6. Cookies</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#sharing">7. Sharing & Disclosures</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#storage">8. Storage & Localization</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#transfers">9. International Transfers</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#retention">10. Retention</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#rights">11. Your Rights</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#children">12. Children</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#security">13. Security</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#integrations">14. Integrations & User Apps</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#tools">15. Platform Tools</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#changes">16. Changes</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#grievance">17. Grievance</a></li>
									</ul>
								</nav>

								<div className="space-y-8 md:space-y-10 text-sm md:text-base leading-6 md:leading-7">
									<section id="intro" className="space-y-3">
										<h2 className="text-xl font-semibold">1. Introduction and Scope</h2>
										<p>
											This Privacy Policy governs how Aqylon Nexus Limited (“Company”, “we”, “us”),
											registered in India, collects, uses, stores, shares, and protects personal data from
											global B2B and B2C users of the NOWG proprietary‑AI platform
											(<a className="underline" href="https://www.nowg.ai" target="_blank" rel="noreferrer">https://www.nowg.ai</a> and
											{" "}<a className="underline" href="https://app.nowg.ai" target="_blank" rel="noreferrer">https://app.nowg.ai</a>).
											NOWG enables users to build, deploy, and monetize web applications using our tools,
											including integrations like Open Router, Vercel, Netlify, Supabase, and Stripe.
											Access requires email‑verified registration and operates on a fixed monthly
											subscription basis. We comply with India’s DPDP Act, IT Act, and applicable
											global standards (e.g., GDPR for EU users).
										</p>
									</section>

									<section id="controller" className="space-y-3">
										<h2 className="text-xl font-semibold">2. Data Controller and Contact</h2>
										<p>
											Aqylon Nexus Limited is the data controller. For privacy queries, rights exercises,
											or grievances, contact <a className="underline" href="mailto:support@nowg.ai">support@nowg.ai</a>.
											A Grievance Officer/Data Protection Officer will be appointed as required under the DPDP Act.
										</p>
									</section>

									<section id="types" className="space-y-3">
										<h2 className="text-xl font-semibold">3. Types of Data Collected</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li><strong>User Identification</strong>: name, email, organization, role, phone (if provided).</li>
											<li><strong>Account Data</strong>: hashed credentials, login history, subscription details, API keys.</li>
											<li><strong>Billing/Payment</strong>: payment tokens, transactions, invoices via Stripe.</li>
											<li><strong>Usage/Technical</strong>: IP, device/browser info, session logs, feature analytics.</li>
											<li><strong>Application Data</strong>: prompts/inputs, generated code/apps, configs, deployment metadata.</li>
											<li><strong>Integration Data</strong>: tokens/credentials for Open Router, Vercel, Netlify, Supabase.</li>
											<li><strong>Generated Content</strong>: outputs from platform tools and monetization settings.
												Sensitive data included in user apps is user‑controlled; ensure compliance.</li>
										</ul>
									</section>

									<section id="sources" className="space-y-3">
										<h2 className="text-xl font-semibold">4. Sources of Data</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>Directly from users: registration, prompts, integration setups.</li>
											<li>Automatically: logs, cookies, analytics during platform use and deployments.</li>
											<li>Third parties: Stripe (payments), Vercel/Netlify/Supabase (deployments), Open Router (model access).</li>
										</ul>
									</section>

									<section id="legal" className="space-y-3">
										<h2 className="text-xl font-semibold">5. Legal Basis and Purposes</h2>
										<p>Processing aligns with consent, contract necessity, legitimate interests, or legal obligations, including:</p>
										<ul className="list-disc pl-5 space-y-2">
											<li>Account verification and subscription management.</li>
											<li>Web‑app building, code generation, testing, debugging, and deployment.</li>
											<li>Third‑party integrations (e.g., Vercel/Netlify deployments, Open Router access, Stripe payments).</li>
											<li>Service delivery, security/fraud detection, and analytics for improvements.</li>
											<li>Billing, dispute resolution, and compliance reporting.</li>
										</ul>
										<p className="text-muted-foreground">
											We process inputs solely to generate outputs; we do not train models on your data without explicit opt‑in.
										</p>
									</section>

									<section id="cookies" className="space-y-3">
										<h2 className="text-xl font-semibold">6. Cookies and Tracking</h2>
										<p>We use essential cookies for sessions and integrations, plus analytics for usage insights. Third‑party cookies from Stripe/Vercel may apply during deployments. You can manage cookies in your browser or in‑app settings where available.</p>
									</section>

									<section id="sharing" className="space-y-3">
										<h2 className="text-xl font-semibold">7. Data Sharing and Disclosures</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li><strong>Processors</strong>: cloud providers in India, Stripe, Vercel, Netlify, Supabase, Open Router — all under DPAs.</li>
											<li><strong>B2B Admins</strong>: team usage/app data may be visible to account owners.</li>
											<li><strong>Authorities</strong>: for lawful requests under Indian/global laws.</li>
										</ul>
										<p>No selling of personal data. Third‑party‑hosted user apps are governed by those providers’ policies.</p>
									</section>

									<section id="storage" className="space-y-3">
										<h2 className="text-xl font-semibold">8. Data Storage and Localization</h2>
										<p>Personal and application data are stored on secure servers within India in compliant data centers, consistent with DPDP localization. Third‑party integrations may store deployed app data per their own policies.</p>
									</section>

									<section id="transfers" className="space-y-3">
										<h2 className="text-xl font-semibold">9. International Data Transfers</h2>
										<p>No routine transfers outside India. Exceptional transfers (e.g., Stripe global operations) use SCCs or equivalent safeguards. EU/UK users benefit from adequacy decisions or appropriate safeguards.</p>
									</section>

									<section id="retention" className="space-y-3">
										<h2 className="text-xl font-semibold">10. Data Retention</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>Active accounts/apps: retained while subscribed.</li>
											<li>Post‑termination: billing/legal data kept up to 7 years; app data deleted on request. Backups are retained securely for disaster recovery.</li>
										</ul>
									</section>

									<section id="rights" className="space-y-3">
										<h2 className="text-xl font-semibold">11. User Rights</h2>
										<p>Depending on your jurisdiction: access, rectification, erasure, restriction, portability, objection, and consent withdrawal.</p>
										<p>Submit requests to <a className="underline" href="mailto:support@nowg.ai">support@nowg.ai</a>. We respond within 30 days (or DPDP timelines). No fee unless requests are excessive.</p>
									</section>

									<section id="children" className="space-y-3">
										<h2 className="text-xl font-semibold">12. Children’s Privacy</h2>
										<p>Service is for 18+ users/competent entities only. We do not knowingly collect minor data.</p>
									</section>

									<section id="security" className="space-y-3">
										<h2 className="text-xl font-semibold">13. Security Measures</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>Encryption (TLS in‑transit, AES at‑rest).</li>
											<li>Access controls (RBAC; MFA recommended).</li>
											<li>Audits, penetration testing, DPDP breach notifications within 72 hours as applicable.</li>
											<li>App‑specific isolation for platform tools; scoped tokens for integrations.</li>
										</ul>
									</section>

									<section id="integrations" className="space-y-3">
										<h2 className="text-xl font-semibold">14. Third‑Party Integrations and User Apps</h2>
										<p>When connecting Open Router, Vercel, Netlify, Supabase, or Stripe, review those providers’ policies. We share only necessary tokens/metadata. Users are responsible for compliance of their deployed apps. Stripe processes payments under PCI‑DSS.</p>
									</section>

									<section id="tools" className="space-y-3">
										<h2 className="text-xl font-semibold">15. Proprietary‑AI Platform Tools Disclosures</h2>
										<p>NOWG’s tools process inputs to generate outputs for web‑app building, editing, and deployment (e.g., code completion, theming). Outputs are user‑owned; inputs are processed transiently. We do not train on your data without consent. You are responsible for legal compliance of generated content.</p>
									</section>

									<section id="changes" className="space-y-3">
										<h2 className="text-xl font-semibold">16. Policy Changes</h2>
										<p>Material updates will be notified via email/in‑app 30 days prior. Continued use constitutes acceptance of the updated policy.</p>
									</section>

									<section id="grievance" className="space-y-3">
										<h2 className="text-xl font-semibold">17. Grievance Redressal</h2>
										<p>Email: <a className="underline" href="mailto:support@nowg.ai">support@nowg.ai</a>. [Grievance Officer details to be inserted]. Governing law: India.</p>
										<p className="text-muted-foreground">
											This policy references “proprietary‑AI platform tools,” India‑based storage, and global integrations. Consult counsel for finalization.
										</p>
									</section>
								</div>

								<footer className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground">
									<p>
										Looking for our home page?{" "}
										<Link to="/" className="underline underline-offset-2 hover:text-foreground">
											Sign in
										</Link>{" "}
										or{" "}
										<Link to="/signup" className="underline underline-offset-2 hover:text-foreground">
											create an account
										</Link>
										.
									</p>
								</footer>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
