import { Link } from "react-router";
import { Header } from "../components";
import Background from "../components/Background";

export default function RefundPolicy() {
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
										Refund Policy
									</h1>
									<p className="mt-2 text-sm text-muted-foreground">
										NOWG Proprietary-AI Platform • Company: Aqylon Nexus Limited
									</p>
								</header>

								<nav className="mb-8 md:mb-10">
									<ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#overview">1. Overview</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#eligibility">2. Eligibility for Refunds</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#process">3. Refund Process</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#exclusions">4. Exclusions</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#international">5. International Considerations</a></li>
										<li><a className="underline underline-offset-2 hover:text-foreground text-muted-foreground" href="#updates">6. Policy Updates</a></li>
									</ul>
								</nav>

								<div className="space-y-8 md:space-y-10 text-sm md:text-base leading-6 md:leading-7">
									<section id="overview" className="space-y-3">
										<h2 className="text-xl font-semibold">1. Overview</h2>
										<p>
											All subscriptions to the NOWG proprietary-AI platform are non-refundable, including for non-usage, 
											except as strictly required by applicable law (e.g., India's Consumer Protection Act, 2019 or EU cooling-off periods). 
											As a SaaS service with proprietary-AI platform tools for web app building and third-party integrations 
											(Open Router, Vercel, Netlify, Supabase, Stripe), access is granted immediately upon payment, 
											incurring server, compute, and support costs.
										</p>
									</section>

									<section id="eligibility" className="space-y-3">
										<h2 className="text-xl font-semibold">2. Eligibility for Refunds</h2>
										<p>Refunds are available only in these limited cases:</p>
										<ul className="list-disc pl-5 space-y-2">
											<li>
												<strong>Technical Errors</strong>: Duplicate billing or failed subscription activation, 
												proven with transaction evidence, requested within 48 hours.
											</li>
											<li>
												<strong>Statutory Rights</strong>: Mandatory refunds under local laws 
												(e.g., 14-day withdrawal for EU consumers, 7-day cooling-off in certain jurisdictions).
											</li>
										</ul>
										<p className="text-muted-foreground">
											No refunds for non-usage, voluntary cancellations, change of mind, or after access is granted. 
											Deployed apps or Stripe transactions follow third-party policies. 
											Usage (even minimal) or passage of time renders the service consumed.
										</p>
									</section>

									<section id="process" className="space-y-3">
										<h2 className="text-xl font-semibold">3. Refund Process</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>
												Submit requests via email to{" "}
												<a className="underline" href="mailto:support@nowg.ai">support@nowg.ai</a>{" "}
												with order ID, reason, and proof (e.g., screenshots).
											</li>
											<li>
												<strong>Processing</strong>: 5-10 business days via original Stripe payment method; 
												Stripe fees non-refundable.
											</li>
											<li>
												There are no partial or pro-rated refunds under any circumstances.
											</li>
											<li>
												Refunds issued to original payer; B2B invoiced clients handled per contract.
											</li>
										</ul>
									</section>

									<section id="exclusions" className="space-y-3">
										<h2 className="text-xl font-semibold">4. Exclusions</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>All non-usage scenarios, regardless of time elapsed or interactions.</li>
											<li>Subscriptions after 48 hours or any platform access.</li>
											<li>Custom integrations, deployed apps, generated outputs, or third-party failures (e.g., Vercel outages).</li>
											<li>
												<strong>Chargebacks</strong>: Treated as breach; may suspend access and pursue recovery fees + legal costs.
											</li>
										</ul>
										<p className="text-muted-foreground">
											No refunds for downtime, dissatisfaction, or force majeure.
										</p>
									</section>

									<section id="international" className="space-y-3">
										<h2 className="text-xl font-semibold">5. International Considerations</h2>
										<ul className="list-disc pl-5 space-y-2">
											<li>
												<strong>EU/UK</strong>: 14-day withdrawal right if no substantial use; 
												notify via email before period ends (statutory exception only).
											</li>
											<li>
												<strong>India</strong>: As per RBI guidelines and Consumer Protection Rules; 
												process within timelines (technical errors only).
											</li>
											<li>
												<strong>Other Regions</strong>: Local statutory minimums apply; no discretionary refunds.
											</li>
										</ul>
									</section>

									<section id="updates" className="space-y-3">
										<h2 className="text-xl font-semibold">6. Policy Updates</h2>
										<p>
											Changes notified 30 days via email/app. Continued use accepts updates.
										</p>
									</section>
								</div>

								<footer className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground">
									<p>
										See also:{" "}
										<Link to="/privacy-policy" className="underline underline-offset-2 hover:text-foreground">
											Privacy Policy
										</Link>{" "}
										•{" "}
										<Link to="/terms-and-conditions" className="underline underline-offset-2 hover:text-foreground">
											Terms and Conditions
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
