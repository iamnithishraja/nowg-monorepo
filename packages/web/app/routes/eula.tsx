import { Link, useNavigate } from "react-router";
import { Header } from "../components";
import Background from "../components/Background";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function EULA() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative text-foreground">
      <Background />
      {/* Persistent Back Button */}
      <Button
        onClick={() => navigate(-1)}
        variant="ghost"
        size="sm"
        className="fixed top-20 left-4 z-50 bg-background/80 backdrop-blur-sm border border-border/60 hover:bg-background/90 transition-all shadow-lg"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <div className="relative z-10 flex min-h-screen flex-col">
        <Header showAuthButtons={true} showSidebarToggle={false} />
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-6 md:px-8 py-8 md:py-12">
            <div className="relative rounded-3xl border border-border/60 bg-background/70 backdrop-blur-2xl shadow-2xl shadow-black/30">
              <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-b from-white/15 via-white/5 to-transparent blur-[1px]" />
              <div className="relative p-6 md:p-10">
                <header className="mb-6 md:mb-8">
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                    End User License Agreement
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Effective date: Commencement Date • Company: Aqylon Nexus
                    Limited
                  </p>
                </header>

                <nav className="mb-8 md:mb-10">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#parties"
                      >
                        Parties
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#grant"
                      >
                        1. Grant of License
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#scope"
                      >
                        2. Scope of Use
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#ownership"
                      >
                        3. Ownership and Proprietary Rights
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#confidentiality"
                      >
                        4. Confidentiality
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#privacy"
                      >
                        5. Data Privacy and Security
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#updates"
                      >
                        6. Updates and Maintenance
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#warranties"
                      >
                        7. Warranties and Disclaimers
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#liability"
                      >
                        8. Limitation of Liability
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#indemnification"
                      >
                        9. Indemnification
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#termination"
                      >
                        10. Term and Termination
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#governing"
                      >
                        11. Governing Law and Jurisdiction
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#integrations"
                      >
                        12. Third-Party Integrations
                      </a>
                    </li>
                    <li>
                      <a
                        className="underline underline-offset-2 hover:text-foreground text-muted-foreground"
                        href="#entire"
                      >
                        13. Entire Agreement
                      </a>
                    </li>
                  </ul>
                </nav>

                <div className="space-y-8 md:space-y-10 text-sm md:text-base leading-6 md:leading-7">
                  <section id="parties" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      Parties to this Agreement
                    </h2>
                    <p>
                      This End User License Agreement ("Agreement") is entered
                      into as of the Commencement Date between:
                    </p>
                    <div className="space-y-4 pl-4 border-l-2 border-border/60">
                      <div>
                        <p className="font-medium">Licensor:</p>
                        <p>
                          Aqylon Nexus Limited ("Company"), a company registered
                          in India, provider of the NOWG proprietary-AI platform
                          accessible at{" "}
                          <a
                            className="underline"
                            href="https://www.nowg.ai"
                            target="_blank"
                            rel="noreferrer"
                          >
                            https://www.nowg.ai
                          </a>{" "}
                          ("Platform").
                        </p>
                      </div>
                      <div>
                        <p className="font-medium">Licensee:</p>
                        <p>
                          The user, entity, or vendor ("You" or "Licensee")
                          authorized to access or integrate with the NOWG
                          platform, including but not limited to third-party
                          vendors like Vercel.
                        </p>
                      </div>
                    </div>
                  </section>

                  <section id="grant" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      1. Grant of License
                    </h2>
                    <p>
                      The Company grants the Licensee a limited, non-exclusive,
                      non-transferable, revocable license to access, use, and
                      integrate with the proprietary-AI platform tools of NOWG
                      solely for the purpose of facilitating deployment, API
                      services, or authorized service enhancements as agreed
                      between the parties.
                    </p>
                  </section>

                  <section id="scope" className="space-y-3">
                    <h2 className="text-xl font-semibold">2. Scope of Use</h2>
                    <p>
                      The license granted herein is in compliance with this
                      Agreement, applicable laws, and any specific integration
                      terms agreed with the Company. License shall not be used
                      for unauthorized resale, reverse engineering,
                      modification, or creating derivative works.
                    </p>
                  </section>

                  <section id="ownership" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      3. Ownership and Proprietary Rights
                    </h2>
                    <p>
                      All rights, title, and interest in and to the NOWG
                      platform—including software, source code, algorithms,
                      documentation, user interfaces, and related intellectual
                      property—remain exclusively with the Company. The Licensee
                      receives no ownership rights under this Agreement.
                    </p>
                  </section>

                  <section id="confidentiality" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      4. Confidentiality
                    </h2>
                    <p>
                      Licensee shall keep all proprietary and technical
                      information received from the Company in strict
                      confidence, implementing adequate safeguards to protect
                      such information from unauthorized disclosure or use,
                      consistent with a reasonable standard of care.
                    </p>
                  </section>

                  <section id="privacy" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      5. Data Privacy and Security
                    </h2>
                    <p>
                      Licensee agrees to comply with the Company's privacy
                      policies and applicable data protection laws when handling
                      data accessed or processed via the Platform. This includes
                      compliance with frameworks such as DPDP (India), GDPR
                      (EU), and others. Personal data transmissions and storage
                      must follow these regulations.
                    </p>
                  </section>

                  <section id="updates" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      6. Updates and Maintenance
                    </h2>
                    <p>
                      The Company may provide updates, patches, or changes to
                      the Platform. Licensee acknowledges that updates may be
                      automatically applied and agrees to cooperate in their
                      implementation.
                    </p>
                  </section>

                  <section id="warranties" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      7. Warranties and Disclaimers
                    </h2>
                    <p>
                      The Platform and license are provided "as is." The Company
                      disclaims all warranties, express or implied, including
                      non-infringement, merchantability, or fitness for a
                      particular purpose.
                    </p>
                  </section>

                  <section id="liability" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      8. Limitation of Liability
                    </h2>
                    <p>
                      Except for gross negligence or willful misconduct, the
                      Company's maximum liability is limited to the fees paid by
                      the Licensee in the last 12 months under this Agreement.
                      The Company is not liable for indirect, incidental,
                      punitive, or consequential damages.
                    </p>
                  </section>

                  <section id="indemnification" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      9. Indemnification
                    </h2>
                    <p>
                      Licensee shall indemnify and hold the Company harmless
                      against third-party claims arising out of Licensee's
                      breach of this Agreement, negligence, or unauthorized use
                      of the Platform.
                    </p>
                  </section>

                  <section id="termination" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      10. Term and Termination
                    </h2>
                    <p>
                      The Agreement begins on the Commencement Date and
                      continues until terminated by either party with 30 days'
                      written notice, or immediately in case of breach. Upon
                      termination, Licensee must cease all use and destroy all
                      related copies.
                    </p>
                  </section>

                  <section id="governing" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      11. Governing Law and Jurisdiction
                    </h2>
                    <p>
                      This Agreement is governed by the laws of India. Courts in
                      Mumbai have exclusive jurisdiction over disputes.
                    </p>
                  </section>

                  <section id="integrations" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      12. Third-Party Integrations
                    </h2>
                    <p>
                      The license acknowledges that integrations with
                      third-party vendors like Vercel are subject to their own
                      terms. Licensee must ensure compliance and agrees not to
                      hold the Company responsible for third-party services.
                    </p>
                  </section>

                  <section id="entire" className="space-y-3">
                    <h2 className="text-xl font-semibold">
                      13. Entire Agreement
                    </h2>
                    <p>
                      This Agreement supersedes all prior understandings
                      regarding the licensed subject matter and may only be
                      amended by a signed written agreement between both
                      parties.
                    </p>
                  </section>
                </div>

                <footer className="mt-10 pt-6 border-t border-border/60 text-xs text-muted-foreground">
                  <p>
                    Looking for our home page?{" "}
                    <Link
                      to="/"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Sign in
                    </Link>{" "}
                    or{" "}
                    <Link
                      to="/signup"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      create an account
                    </Link>
                    . You can also view our{" "}
                    <Link
                      to="/privacy-policy"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Privacy Policy
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
