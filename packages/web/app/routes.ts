import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("/signin", "routes/signin.tsx"),
  route("/home", "routes/home.tsx"),
  route(
    "/.well-known/appspecific/com.chrome.devtools.json",
    "routes/.well-known/appspecific/com.chrome.devtools.json.tsx",
  ),
  route("/workspace/*", "routes/workspace.tsx"),
  route("/api/support-tickets/:ticketId/call-request", "routes/api.support-tickets.$ticketId.call-request.tsx"),
  route("/api/contact", "routes/api.contact.tsx"),
  route("/api/support-tickets", "routes/api.support-tickets.tsx"),
  route("/api/faqs", "routes/api.faqs.tsx"),
  route("/signup", "routes/signup.tsx"),
  route("/forgot-password", "routes/forgot-password.tsx"),
  route("/reset-password", "routes/reset-password.tsx"),
  route("/privacy-policy", "routes/privacy-policy.tsx"),
  route("/terms-and-conditions", "routes/terms-and-conditions.tsx"),
  route("/refund-policy", "routes/refund-policy.tsx"),
  route("/EULA", "routes/eula.tsx"),
  route("/docs/integrations/vercel", "routes/docs.integrations.vercel.tsx"),
  route("/analytics", "routes/analytics.tsx"),
  route("/profile", "routes/profile.tsx"),
  route("/support", "routes/support.tsx"),
  route("/recharge", "routes/recharge.tsx"),
  route("/api/stripe/checkout", "routes/api.stripe.checkout.tsx"),
  route("/api/profile/balance", "routes/api.profile.balance.tsx"),
  route("/api/profile", "routes/api.profile.tsx"),
  route("/api/stripe/verify", "routes/api.stripe.verify.tsx"),
  route("/payment-success", "routes/payment-success.tsx"),
  route("/deployments", "routes/deployments.tsx"),
  route("/supabase-projects", "routes/supabase-projects.tsx"),
  route("/manage-org/convo", "routes/manage-org.convo.tsx"),
  route("/manage-org/review-docs", "routes/manage-org.review-docs.tsx"),
  route("/teams", "routes/teams.tsx"),
  route("/api/figma/frames", "routes/api.figma.frames.tsx"),
  route("/api/figma/mcp", "routes/api.figma.mcp.tsx"),
  route("/teams/:teamId", "routes/teams.$teamId.tsx"),

  // Organization invitation routes (public)
  route("/organizations/user/accept", "routes/organizations.user.accept.tsx"),
  route("/organizations/user/reject", "routes/organizations.user.reject.tsx"),

  // Admin routes
  route("/admin", "routes/admin.tsx"),
  route("/admin/users", "routes/admin.users.tsx"),
  route("/admin/organizations", "routes/admin.organizations.tsx"),
  route(
    "/admin/organizations/:organizationId/wallet",
    "routes/admin.organizations.$organizationId.wallet.tsx",
  ),
  route("/admin/organizations/ledger", "routes/admin.organizations.ledger.tsx"),
  route("/admin/projects", "routes/admin.projects.tsx"),
  route(
    "/admin/projects/:projectId/members",
    "routes/admin.projects.$projectId.members.tsx",
  ),

  route(
    "/admin/projects/:projectId/wallet",
    "routes/admin.projects.$projectId.wallet.tsx",
  ),
  route(
    "/admin/projects/:projectId/fund-requests",
    "routes/admin.projects.$projectId.fund-requests.tsx",
  ),
  route("/admin/projects/ledger", "routes/admin.projects.ledger.tsx"),
  route("/admin/fund-requests", "routes/admin.fund-requests.tsx"),
  route("/admin/wallet", "routes/admin.wallet.tsx"),
  route("/admin/analytics", "routes/admin.analytics.tsx"),
  route(
    "/admin/analytics/project/:projectId",
    "routes/admin.analytics.project.$projectId.tsx",
  ),
  route("/admin/ledger", "routes/admin.ledger.tsx"),
  route("/admin/markup", "routes/admin.markup.tsx"),

  // Auth routes - login must come before catch-all
  route("/api/auth/login", "routes/api.auth.login.tsx"),
  route(
    "/api/admin/project-wallets/:projectId/transfer-from-org",
    "routes/api.admin.project-wallets.$projectId.transfer-from-org.tsx",
  ),
  route(
    "/api/admin/project-wallets/:projectId/credit-back-to-org",
    "routes/api.admin.project-wallets.$projectId.credit-back-to-org.tsx",
  ),
  route(
    "/api/admin/project-wallets/:projectId/stripe-checkout",
    "routes/api.admin.project-wallets.$projectId.stripe-checkout.tsx",
  ),
  route(
    "/api/admin/project-wallets/:projectId/stripe-verify",
    "routes/api.admin.project-wallets.$projectId.stripe-verify.tsx",
  ),
  route("/api/admin/fund-requests", "routes/api.admin.fund-requests.tsx"),
  route(
    "/api/admin/fund-requests/:requestId/approve",
    "routes/api.admin.fund-requests.$requestId.approve.tsx",
  ),
  route("/api/admin/markup", "routes/api.admin.markup.tsx"),
  route(
    "/api/admin/fund-requests/:requestId/reject",
    "routes/api.admin.fund-requests.$requestId.reject.tsx",
  ),
  route("/api/admin/upload-image", "routes/api.admin.upload-image.tsx"),
  route("/api/check-user", "routes/api.check-user.tsx"),
  route("/api/auth/user", "routes/api.auth.user.tsx"),
  route("/api/auth/*", "routes/api.auth.$.tsx"),
  route("/api/llm/chat", "routes/api.llm.chat.tsx"),
  route("/api/agent", "routes/api.agent.tsx"),
  route("/api/webfetch", "routes/api.webfetch.tsx"),
  route("/api/templates/select", "routes/api.templates.select.tsx"),
  route("/api/enhancer", "routes/api.enhancer.tsx"),
  route("/api/supabase/provision", "routes/api.supabase.provision.tsx"),
  route("/api/supabase/tables", "routes/api.supabase.tables.tsx"),
  route("/api/supabase/rows", "routes/api.supabase.rows.tsx"),
  route("/api/supabase/connect", "routes/api.supabase.connect.tsx"),
  route("/api/supabase/callback", "routes/api.supabase.callback.tsx"),
  route("/api/supabase/token", "routes/api.supabase.token.tsx"),
  route("/api/supabase/disconnect", "routes/api.supabase.disconnect.tsx"),
  route("/api/neon/provision", "routes/api.neon.provision.tsx"),
  route("/api/figma/connect", "routes/api.figma.connect.tsx"),
  route("/api/figma/callback", "routes/api.figma.callback.tsx"),
  route("/api/figma/token", "routes/api.figma.token.tsx"),
  route("/api/figma/disconnect", "routes/api.figma.disconnect.tsx"),
  route("/api/conversations", "routes/api.conversations.tsx"),
  route("/api/files", "routes/api.files.tsx"),
  route("/api/conversation-versions", "routes/api.conversation-versions.tsx"),
  route("/api/github/import", "routes/api.github.import.tsx"),
  route("/api/github/import/callback", "routes/api.github.import.callback.tsx"),
  route(
    "/api/github/repository/create",
    "routes/api.github.repository.create.tsx",
  ),
  route("/api/github/repository/push", "routes/api.github.repository.push.tsx"),
  route(
    "/api/github/repository/status",
    "routes/api.github.repository.status.tsx",
  ),
  route(
    "/api/github/repository/delete",
    "routes/api.github.repository.delete.tsx",
  ),
  route(
    "/api/github/repository/token",
    "routes/api.github.repository.token.tsx",
  ),
  route("/api/llm/analyze", "routes/api.llm.analyze.tsx"),
  route("/api/applyEditToSource", "routes/api.applyEditToSource.tsx"),
  route("/api/deploy/vercel", "routes/api.deploy.vercel.tsx"),
  route("/api/deploy/netlify", "routes/api.deploy.netlify.tsx"),
  route("/api/deployments", "routes/api.deployments.tsx"),
  route("/api/deployments/promote", "routes/api.deployments.promote.tsx"),
  route("/api/supabase/projects", "routes/api.supabase.projects.tsx"),
  route("/api/analytics", "routes/api.analytics.tsx"),
  route(
    "/api/organization-conversations",
    "routes/api.organization-conversations.tsx",
  ),
  route("/api/organizations", "routes/api.organizations.tsx"),
  route("/api/organizations/documents", "routes/api.organizations.documents.tsx"),
  route("/api/organizations/:organizationId", "routes/api.organizations.$organizationId.tsx"),
  route("/api/user-organizations", "routes/api.user-organizations.tsx"),
  route(
    "/api/user-project-memberships",
    "routes/api.user-project-memberships.tsx",
  ),
  route("/api/organizations/wallet", "routes/api.organizations.wallet.tsx"),
  route(
    "/api/organizations/user/accept",
    "routes/api.organizations.user.accept.tsx",
  ),
  route(
    "/api/organizations/user/reject",
    "routes/api.organizations.user.reject.tsx",
  ),
  route(
    "/api/organizations/wallet/checkout",
    "routes/api.organizations.wallet.checkout.tsx",
  ),
  route(
    "/api/organizations/wallet/verify",
    "routes/api.organizations.wallet.verify.tsx",
  ),

  // Team API routes
  route("/api/teams", "routes/api.teams.tsx"),
  route("/api/teams/members", "routes/api.teams.members.tsx"),
  route("/api/teams/invitations", "routes/api.teams.invitations.tsx"),
  route("/api/teams/wallet", "routes/api.teams.wallet.tsx"),
  route("/api/teams/wallet/checkout", "routes/api.teams.wallet.checkout.tsx"),
  route("/api/teams/wallet/verify", "routes/api.teams.wallet.verify.tsx"),
  route("/api/teams/projects", "routes/api.teams.projects.tsx"),

  // Admin API routes (login already defined above)
  route("/api/admin/me", "routes/api.admin.me.tsx"),
  route("/api/admin/users/*", "routes/api.admin.users.tsx"),
  route("/api/admin/user-detail", "routes/api.admin.user-detail.tsx"),
  route("/api/admin/update-role", "routes/api.admin.update-role.tsx"),
  route("/api/admin/dashboard/stats", "routes/api.admin.dashboard.tsx"),
  route("/api/admin/token-usage", "routes/api.admin.token-usage.tsx"),
  route("/api/admin/wallet", "routes/api.admin.wallet.tsx"),
  route("/api/admin/organizations", "routes/api.admin.organizations.tsx"),
  route(
    "/api/admin/organizations/search-user",
    "routes/api.admin.organizations.search-user.tsx",
  ),
  route(
    "/api/admin/organizations/:organizationId/invite-user",
    "routes/api.admin.organizations.$organizationId.invite-user.tsx",
  ),
  route(
    "/api/admin/organizations/:organizationId/users",
    "routes/api.admin.organizations.$organizationId.users.tsx",
  ),
  route(
    "/api/admin/organizations/:organizationId/users/:userId",
    "routes/api.admin.organizations.$organizationId.users.$userId.tsx",
  ),
  route(
    "/api/admin/organizations/:organizationId/users/:userId/role",
    "routes/api.admin.organizations.$organizationId.users.$userId.role.tsx",
  ),
  route(
    "/api/admin/organizations/:organizationId",
    "routes/api.admin.organizations.$organizationId.tsx",
  ),
  route(
    "/api/admin/organizations/:organizationId/payment-provider",
    "routes/api.admin.organizations.$organizationId.payment-provider.tsx",
  ),
  route("/api/admin/projects", "routes/api.admin.projects.tsx"),
  route(
    "/api/admin/projects/:projectId",
    "routes/api.admin.projects.$projectId.tsx",
  ),
  route(
    "/api/admin/projects/:projectId/members",
    "routes/api.admin.projects.$projectId.members.tsx",
  ),
  route(
    "/api/admin/projects/:projectId/members/:memberId",
    "routes/api.admin.projects.$projectId.members.$memberId.tsx",
  ),
  route(
    "/api/admin/projects/:projectId/users/:userId/role",
    "routes/api.admin.projects.$projectId.users.$userId.role.tsx",
  ),
  route(
    "/api/admin/organizations/:organizationId/available-users",
    "routes/api.admin.organizations.$organizationId.available-users.tsx",
  ),
  route(
    "/api/admin/project-admin/users",
    "routes/api.admin.project-admin.users.tsx",
  ),
  route(
    "/api/admin/projects/:projectId/assign-admin",
    "routes/api.admin.projects.$projectId.assign-admin.tsx",
  ),
  route(
    "/api/admin/projects/:projectId/admin",
    "routes/api.admin.projects.$projectId.admin.tsx",
  ),
  route(
    "/api/admin/org-wallets/:organizationId/stripe-checkout",
    "routes/api.admin.org-wallets.$organizationId.stripe-checkout.tsx",
  ),
  route(
    "/api/admin/org-wallets/:organizationId/stripe-verify",
    "routes/api.admin.org-wallets.$organizationId.stripe-verify.tsx",
  ),
  route(
    "/api/admin/org-wallets/:organizationId/add-credits",
    "routes/api.admin.org-wallets.$organizationId.add-credits.tsx",
  ),
  route(
    "/api/admin/org-wallets/:organizationId/transactions",
    "routes/api.admin.org-wallets.$organizationId.transactions.tsx",
  ),
  route(
    "/api/admin/org-wallets/:organizationId/ledger",
    "routes/api.admin.org-wallets.$organizationId.ledger.tsx",
  ),
  route(
    "/api/admin/org-wallets/:organizationId",
    "routes/api.admin.org-wallets.$organizationId.tsx",
  ),
  route(
    "/api/admin/project-wallets/:projectId/transactions",
    "routes/api.admin.project-wallets.$projectId.transactions.tsx",
  ),
  route(
    "/api/admin/project-wallets/:projectId/ledger",
    "routes/api.admin.project-wallets.$projectId.ledger.tsx",
  ),
  route(
    "/api/admin/project-wallets/:projectId",
    "routes/api.admin.project-wallets.$projectId.tsx",
  ),
  route(
    "/api/admin/user-project-wallets/project/:projectId",
    "routes/api.admin.user-project-wallets.project.$projectId.tsx",
  ),
  route(
    "/api/admin/user-project-wallets/user/:userId",
    "routes/api.admin.user-project-wallets.user.$userId.tsx",
  ),
  route(
    "/api/admin/user-project-wallets/:projectId/:userId/set-limit",
    "routes/api.admin.user-project-wallets.$projectId.$userId.set-limit.tsx",
  ),
  route(
    "/api/admin/user-project-wallets/:projectId/:userId/reset-spending",
    "routes/api.admin.user-project-wallets.$projectId.$userId.reset-spending.tsx",
  ),
  route("/api/admin/vercel-stats", "routes/api.admin.vercel-stats.tsx"),
  route("/api/admin/netlify-stats", "routes/api.admin.netlify-stats.tsx"),
  route("/api/admin/supabase-stats", "routes/api.admin.supabase-stats.tsx"),
  route("/api/admin/env-configs", "routes/api.admin.env-configs.tsx"),
  route(
    "/api/admin/analytics/project/:projectId",
    "routes/api.admin.analytics.project.$projectId.tsx",
  ),
  route(
    "/api/admin/analytics/organization/:organizationId",
    "routes/api.admin.analytics.organization.$organizationId.tsx",
  ),
  route("/api/admin/ledger", "routes/api.admin.ledger.tsx"),
  route("/api/admin/ledger/summary", "routes/api.admin.ledger.summary.tsx"),
  route(
    "/api/admin/ledger/organizations",
    "routes/api.admin.ledger.organizations.tsx",
  ),
  route("/api/admin/ledger/projects", "routes/api.admin.ledger.projects.tsx"),
  route(
    "/api/admin/ledger/download-pdf",
    "routes/api.admin.ledger.download-pdf.tsx",
  ),

  route("/api/preload-cache", "routes/api.preload-cache.tsx"),
  route("/api/notifications", "routes/api.notifications.tsx"),

  // Disabled routes that depend on removed adminModel.ts
  // route("/api/admin/payment-gateways/*", "routes/api.admin.payment-gateways.tsx"),
  // route("/api/admin/kyc-records/*", "routes/api.admin.kyc-records.tsx"),
  // route("/api/admin/plans/*", "routes/api.admin.plans.tsx"),
  // route("/api/admin/llm-configs/*", "routes/api.admin.llm-configs.tsx"),
  // route("/api/admin/transactions", "routes/api.admin.transactions.tsx"),
  // route("/api/admin/cms-settings", "routes/api.admin.cms-settings.tsx"),
  // route("/api/admin/affiliates/*", "routes/api.admin.affiliates.tsx"),
  // route("/api/admin/white-label/*", "routes/api.admin.white-label.tsx"),
  // route("/api/admin/ai-agents/*", "routes/api.admin.ai-agents.tsx"),
  // route("/api/admin/teams", "routes/api.admin.teams.tsx"),
  // route("/api/admin/subscriptions", "routes/api.admin.subscriptions.tsx"),
] satisfies RouteConfig;
