import { Link } from "react-router";
import { Header } from "../components";
import Background from "../components/Background";

export default function TermsAndConditions() {
	return (
		<div className="min-h-screen relative text-foreground">
			<Background />
			<div className="relative z-10 flex min-h-screen flex-col">
				<Header showAuthButtons={true} showSidebarToggle={false} />
				<main className="flex-1">
					<div className="mx-auto max-w-4xl px-6 md:px-8 py-8 md:py-12">
						<div className="relative rounded-3xl border border-border/60 bg-background/70 backdrop-blur-2xl shadow-2xl shadow-black/30">
							<div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-white/15 via-white/5 to-transparent blur-[1px]" />
							<div className="relative p-6 md:p-10">
								<header className="mb-6 md:mb-8">
									<h1 className="text-3xl md:text-4xl font-semibold tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
										Terms and Conditions
									</h1>
									<p className="mt-2 text-sm text-muted-foreground">
										NOWG Proprietary-AI Platform • Company: Aqylon Nexus Limited
									</p>
								</header>

								<nav className="mb-8 md:mb-10">
									<ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#acceptance">1. Acceptance of Terms</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#service">2. Service Description</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#eligibility">3. Eligibility and Registration</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#subscriptions">4. Subscriptions and Payments</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#license">5. License Grant and Restrictions</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#content">6. User Content and Generated Outputs</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#integrations">7. Third-Party Integrations</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#ip">8. Intellectual Property</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#responsibilities">9. User Responsibilities</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#availability">10. Service Availability and SLA</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#privacy">11. Data Privacy and Security</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#disclaimers">12. Disclaimers and Warranties</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#liability">13. Limitation of Liability</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#indemnification">14. Indemnification</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#termination">15. Termination and Suspension</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#governing">16. Governing Law and Disputes</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#changes">17. Changes to Terms</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#miscellaneous">18. Miscellaneous</a></li>
									</ul>
								</nav>

								<div className="space-y-8 md:space-y-10 text-sm md:text-base leading-6 md:leading-7">
									<section id="acceptance" className="space-y-3">
										<h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
										<p>
											By accessing or using the NOWG proprietary-AI platform ("Platform", "Service", or "NOWG") at{" "}
											<a className="underline" href="https://www.nowg.ai" target="_blank" rel="noreferrer">https://www.nowg.ai</a> or{" "}
											<a className="underline" href="https://app.nowg.ai" target="_blank" rel="noreferrer">https://app.nowg.ai</a>, 
											you ("User", "You", "Client") agree to these Terms and Conditions ("Terms"),{" "}
											<Link to="/privacy-policy" className="underline">Privacy Policy</Link>, and Acceptable Use Policy. 
											Access requires email-verified registration and is available globally to B2B and B2C users on a fixed monthly subscription basis. 
											Aqylon Nexus Limited ("Company", "we", "us") and registered in India, provides the Service. 
											If you do not agree, do not use the Platform.
										</p>
									</section>

									<section id="service" className="space-y-3">
										<h2 className="text-xl font-semibold">2. Service Description</h2>
										<p>
											NOWG is a proprietary-AI platform enabling users to build, test, deploy, and monetize web applications 
											using our proprietary-AI platform tools for code generation, editing, debugging, and configuration. 
											Features include integrations with third-party services like Open Router (AI models), Vercel/Netlify (deployment), 
											Supabase (databases), and Stripe (payments). All user and application data is stored exclusively on secure servers in India.
										</p>
									</section>

									<section id="eligibility" className="space-y-3">
										<h2 className="text-xl font-semibold">3. Eligibility and Registration</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>You must be 18+ or a legally competent entity.</li>
											<li>
												Registration via email verification at{" "}
												<a className="underline" href="https://app.nowg.ai" target="_blank" rel="noreferrer">https://app.nowg.ai</a>{" "}
												is mandatory; each user gets one account.
											</li>
											<li>
												You are responsible for account security, including API keys/tokens for integrations. 
												Unauthorized use is your liability.
											</li>
										</ul>
									</section>

									<section id="subscriptions" className="space-y-3">
										<h2 className="text-xl font-semibold">4. Subscriptions and Payments</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>
												Fixed monthly subscriptions as listed on{" "}
												<a className="underline" href="https://www.nowg.ai/#" target="_blank" rel="noreferrer">https://www.nowg.ai/#</a>, 
												billed in advance via Stripe.
											</li>
											<li>Auto-renews monthly unless cancelled before renewal; no refunds except as required by law.</li>
											<li>Late payments are suspended after 7 days; fees may change with 30 days' notice.</li>
											<li>Taxes, currency conversion, and Stripe fees apply.</li>
										</ul>
									</section>

									<section id="license" className="space-y-3">
										<h2 className="text-xl font-semibold">5. License Grant and Restrictions</h2>
										<p>
											Limited, non-exclusive, non-transferable, revocable license to use NOWG for lawful web app building/deploying during your subscription.
										</p>
										<p><strong>Prohibited:</strong></p>
										<ul className="list-disc pl-5 space-y-2">
											<li>Reverse-engineering proprietary AI platform tools</li>
											<li>Reselling access</li>
											<li>Exceeding rate limits</li>
											<li>Using for illegal activities</li>
											<li>Scraping or automating without permission</li>
										</ul>
										<p className="text-muted-foreground">
											<strong>Integrations:</strong> You must comply with third-party terms (e.g., Vercel, Stripe); 
											we share only necessary tokens/metadata.
										</p>
									</section>

									<section id="content" className="space-y-3">
										<h2 className="text-xl font-semibold">6. User Content and Generated Outputs</h2>
										<p>
											Your own inputs (prompts, configs) and outputs (code, apps) from proprietary-AI platform tools, 
											subject to our limited license to process/store for service delivery.
										</p>
										<ul className="list-disc pl-5 space-y-2">
											<li>
												You grant us a worldwide, royalty-free license to use anonymized data for improvements 
												(no training without opt-in).
											</li>
											<li>
												You warrant content legality/compliance; we are not liable for user-generated apps or deployments.
											</li>
										</ul>
									</section>

									<section id="integrations" className="space-y-3">
										<h2 className="text-xl font-semibold">7. Third-Party Integrations</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>
												Connections to Open Router, Vercel, Netlify, Supabase, Stripe are at your risk; 
												review their terms/policies.
											</li>
											<li>
												Deployed apps on third-party hosts are governed by those providers' post-deployment; 
												we do not access/control them.
											</li>
											<li>
												Stripe processes payments PCI-DSS compliant; we do not store full payment details.
											</li>
										</ul>
									</section>

									<section id="ip" className="space-y-3">
										<h2 className="text-xl font-semibold">8. Intellectual Property</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>
												All Platform elements (code, proprietary-AI platform tools, UI, trademarks) are owned by the Company. 
												No transfer except licensed rights.
											</li>
											<li>
												User apps may include our attribution if required (e.g., "Powered by NOWG").
											</li>
										</ul>
									</section>

									<section id="responsibilities" className="space-y-3">
										<h2 className="text-xl font-semibold">9. User Responsibilities and Acceptable Use</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>Comply with laws (e.g., GDPR for EU apps, DPDP in India).</li>
											<li>No malware, spam, phishing, or harmful apps.</li>
											<li>Secure your integrations, report vulnerabilities promptly.</li>
										</ul>
									</section>

									<section id="availability" className="space-y-3">
										<h2 className="text-xl font-semibold">10. Service Availability and SLA</h2>
										<p>
											Commercially reasonable efforts for 99% monthly uptime (target, non-binding), 
											excluding maintenance/third-party issues. See startup-friendly SLA in Terms for details on support 
											(<a className="underline" href="mailto:support@nowg.ai">support@nowg.ai</a>) and exclusions.
										</p>
									</section>

									<section id="privacy" className="space-y-3">
										<h2 className="text-xl font-semibold">11. Data Privacy and Security</h2>
										<p>
											Governed by the{" "}
											<Link to="/privacy-policy" className="underline">Privacy Policy</Link>. 
											Data stored in India; encryption, audits, breach notifications per DPDP. 
											You consent to processing for service/integrations.
										</p>
									</section>

									<section id="disclaimers" className="space-y-3">
										<h2 className="text-xl font-semibold">12. Disclaimers and Warranties</h2>
										<p>
											Service provided "as is", no warranties of merchantability, fitness, or uninterrupted access. 
											Proprietary AI outputs may contain errors; user validation required. 
											Third-party integrations are not warranted.
										</p>
									</section>

									<section id="liability" className="space-y-3">
										<h2 className="text-xl font-semibold">13. Limitation of Liability</h2>
										<p>
											To the maximum extent permitted, the Company's liability is limited to fees paid in the prior 3 months. 
											No consequential/indirect damage. Higher limits negotiable for enterprises.
										</p>
									</section>

									<section id="indemnification" className="space-y-3">
										<h2 className="text-xl font-semibold">14. Indemnification</h2>
										<p>
											You indemnify us against claims from your content/apps, misuse, or integrations.
										</p>
									</section>

									<section id="termination" className="space-y-3">
										<h2 className="text-xl font-semibold">15. Termination and Suspension</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>Cancel anytime, access until period ends.</li>
											<li>We may suspend/terminate violations, non-payment, with notice where possible.</li>
											<li>Post-termination: Data deletion per retention policy; backups held briefly.</li>
										</ul>
									</section>

									<section id="governing" className="space-y-3">
										<h2 className="text-xl font-semibold">16. Governing Law and Disputes</h2>
										<p>
											Governed by Indian laws; exclusive jurisdiction in Mumbai courts. 
											For EU users, mandatory arbitration is required. No class actions.
										</p>
									</section>

									<section id="changes" className="space-y-3">
										<h2 className="text-xl font-semibold">17. Changes to Terms</h2>
										<p>
											Updates notified 30 days in advance via email/app. Continued use = acceptance.
										</p>
									</section>

									<section id="miscellaneous" className="space-y-3">
										<h2 className="text-xl font-semibold">18. Miscellaneous</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li><strong>Severability:</strong> Invalid provisions do not affect others.</li>
											<li><strong>Force majeure:</strong> Excused for uncontrollable events.</li>
											<li><strong>Entire agreement:</strong> Supersedes priors.</li>
											<li>
												<strong>Contact:</strong>{" "}
												<a className="underline" href="mailto:support@nowg.ai">support@nowg.ai</a>
											</li>
										</ul>
									</section>
								</div>

								<footer className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground">
									<p>
										See also:{" "}
										<Link to="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
											Privacy Policy
										</Link>{" "}
										•{" "}
										<Link to="/refund-policy" className="underline underline-offset-2 hover:text-foreground">
											Refund Policy
										</Link>{" "}
										•{" "}
										<Link to="/eula" className="underline underline-offset-2 hover:text-foreground">
											EULA
										</Link>
									</p>
									<p className="mt-2">
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
