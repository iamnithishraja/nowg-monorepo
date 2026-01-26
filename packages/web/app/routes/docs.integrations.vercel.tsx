import { Header } from "../components";
import Background from "../components/Background";

export default function VercelIntegrationDocs() {
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
										Deploy to Vercel (Your Account)
									</h1>
									<p className="mt-2 text-sm text-muted-foreground">
										Follow this guide to deploy apps from Nowgai to your own Vercel
										account. We never deploy to our account on your behalf.
									</p>
								</header>

								<div className="prose prose-invert max-w-none text-sm md:text-base leading-6 md:leading-7">
									<h2>Prerequisites</h2>
									<ul>
										<li>
											A Vercel account. If you don&apos;t have one,&nbsp;
											<a href="https://vercel.com/signup" target="_blank" rel="noreferrer">
												create it here
											</a>
											.
										</li>
										<li>
											Optional but recommended: a GitHub repository for your project
											(Nowgai can create one for you via the GitHub export/import flow).
										</li>
									</ul>

									<h2>How deployment works</h2>
									<ol>
										<li>
											In Nowgai, open your project workspace and choose{" "}
											<strong>Deploy → Vercel</strong>.
										</li>
										<li>
											You will be redirected to Vercel to authorize our app. Grant
											access to the repositories you want to deploy. Authorization
											happens on Vercel and can be revoked at any time from your Vercel
											settings.
										</li>
										<li>
											Back in Nowgai, select the Vercel <strong>team</strong> (personal
											or organization), confirm the <strong>project name</strong>, and
											start the deployment.
										</li>
										<li>
											We create or connect a Vercel project under your account and
											trigger a deploy. Subsequent updates are redeployed from the same
											flow.
										</li>
									</ol>

									<h2>Environment variables</h2>
									<p>
										If your app requires environment variables, set them in the Vercel
										Project under <em>Settings → Environment Variables</em>. Re‑deploy
										after saving. You can also store secrets in Vercel and reference
										them from the deployment flow.
									</p>

									<h2>Troubleshooting</h2>
									<ul>
										<li>
											<strong>Authorization errors</strong>: Revisit{" "}
											<a
												href="https://vercel.com/integrations"
												target="_blank"
												rel="noreferrer"
											>
												Vercel Integrations
											</a>{" "}
											and ensure the integration is installed for the correct team and
											repositories.
										</li>
										<li>
											<strong>Build failures</strong>: Check the Vercel build logs on
											your project&apos;s <em>Deployments</em> tab. Verify the correct
											Node version and environment variables are set.
										</li>
										<li>
											<strong>Wrong account/team</strong>: In the deployment dialog,
											choose the intended Vercel team. You can always move a project
											inside Vercel later if needed.
										</li>
									</ul>

									<h2>Data and permissions</h2>
									<p>
										The integration only uses the minimal OAuth scopes required to
										create and deploy projects on your behalf. Deployments happen
										exclusively to your Vercel account and teams.
									</p>

									<p>
										Need help? Reach us via the in‑app support channel or email listed
										on our <a href="/support">Support</a> page.
									</p>
								</div>
							</div>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}


