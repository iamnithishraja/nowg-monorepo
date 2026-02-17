import type { ActionFunctionArgs } from "react-router";
import { DeploymentService } from "~/lib/deploymentService";
import { auth } from "~/lib/auth";
import { getEnv } from "~/lib/env";
import { VersionSnapshotService } from "~/lib/versionSnapshotService";

interface DeployFile {
  path: string;
  content: string;
}

const versionService = new VersionSnapshotService();

// Helper to disable password protection and Vercel Authentication (SSO Protection) on a Vercel project
async function disableDeploymentProtection(
  projectId: string,
  token: string,
  teamId?: string,
): Promise<void> {
  try {
    const updateUrl = new URL(
      `https://api.vercel.com/v9/projects/${projectId}`,
    );
    if (teamId) updateUrl.searchParams.set("teamId", teamId);

    const updateRes = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        passwordProtection: null, // Disable password protection
        ssoProtection: null, // Disable Vercel Authentication (SSO Protection)
        // This makes preview deployments publicly accessible without requiring Vercel account login
      }),
    });

    if (!updateRes.ok) {
      // Don't throw - this is not critical for deployment
    }
  } catch (error) {
    // Don't throw - this is not critical for deployment
  }
}

// Helper to get or create Vercel project
async function getOrCreateVercelProject(
  projectName: string,
  token: string,
  teamId?: string,
): Promise<string | null> {
  try {
    // Try to get existing project
    const getUrl = new URL(`https://api.vercel.com/v9/projects/${projectName}`);
    if (teamId) getUrl.searchParams.set("teamId", teamId);

    const getRes = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (getRes.ok) {
      const project = await getRes.json();
      const projectId = project.id;
      // Disable deployment protection (password + Vercel Auth) on existing project
      await disableDeploymentProtection(projectId, token, teamId);
      return projectId;
    }

    // Project doesn't exist, create it
    const createUrl = new URL("https://api.vercel.com/v9/projects");
    if (teamId) createUrl.searchParams.set("teamId", teamId);

    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectName,
        framework: "vite",
        buildCommand: "npm run build",
        installCommand: "npm install",
        outputDirectory: "dist",
      }),
    });

    if (createRes.ok) {
      const project = await createRes.json();
      const projectId = project.id;
      // Disable deployment protection (password + Vercel Auth) on newly created project
      await disableDeploymentProtection(projectId, token, teamId);
      return projectId;
    }

    return null;
  } catch (error) {
    console.error("Error getting/creating Vercel project:", error);
    return null;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Get authenticated user session
        const authInstance = await auth;
        const session = await authInstance.api.getSession({
          headers: request.headers,
        });

        if (!session) {
          send({ type: "error", message: "Authentication required" });
          controller.close();
          return;
        }

        const userId = session.user.id;
        const body = await request.json();
        let files: DeployFile[] = body.files || [];
        const conversationId: string = body.conversationId;
        const versionId: string | undefined = body.versionId;
        const framework: string = body.framework || "vite";

        // Initialize deployment service early so we can use it for version checks
        const deploymentService = new DeploymentService();

        // If versionId is provided, fetch files from that version
        if (versionId) {
          try {
            // Check if this version is already deployed
            const isAlreadyDeployed = await deploymentService.isVersionDeployed(
              conversationId,
              versionId,
              "vercel",
            );
            if (isAlreadyDeployed) {
              send({
                type: "error",
                message: "This version has already been deployed to Vercel",
              });
              controller.close();
              return;
            }

            const version = await versionService.get(versionId, userId);
            if (!version) {
              send({ type: "error", message: "Version not found" });
              controller.close();
              return;
            }
            // Convert version files to DeployFile format
            files = version.files.map((f) => ({
              path: f.path,
              content: f.content,
            }));
          } catch (error) {
            console.error("Error loading version files:", error);
            send({
              type: "error",
              message: `Failed to load version files: ${
                error instanceof Error ? error.message : String(error)
              }`,
            });
            controller.close();
            return;
          }
        }

        // NEW: Create unique project name per conversation
        const projectName = `nowgai-${conversationId}-app`;

        if (!Array.isArray(files) || files.length === 0) {
          send({ type: "error", message: "No files provided for deployment" });
          controller.close();
          return;
        }

        const token = getEnv("VERCEL_ACCESS_TOKEN");
        const teamId = getEnv("VERCEL_TEAM_ID");

        if (!token) {
          send({
            type: "error",
            message: "VERCEL_ACCESS_TOKEN is not configured on the server",
          });
          controller.close();
          return;
        }

        // NEW: Check if we have an existing deployment for this conversation
        const existingDeployments =
          await deploymentService.getDeployments(conversationId);
        const latestDeployment = existingDeployments
          .filter((d: any) => d.platform === "vercel")
          .sort(
            (a: any, b: any) =>
              new Date(b.deployedAt).getTime() -
              new Date(a.deployedAt).getTime(),
          )[0];

        send({
          type: "status",
          stage: "creating",
          message: "Preparing Vercel deployment...",
        });

        // NEW: Get or create Vercel project
        let vercelProjectId = latestDeployment?.vercelProjectId;
        if (!vercelProjectId) {
          vercelProjectId = await getOrCreateVercelProject(
            projectName,
            token,
            teamId,
          );
          if (!vercelProjectId) {
            send({
              type: "error",
              message: "Failed to create or access Vercel project",
            });
            controller.close();
            return;
          }
        } else {
          // Ensure deployment protection is disabled on existing project
          await disableDeploymentProtection(vercelProjectId, token, teamId);
        }

        const vercelFiles = files.map((f) => ({
          file: (f.path || "").replace(/^\/+/, ""),
          data: Buffer.from(f.content || "").toString("base64"),
          encoding: "base64",
        }));

        const payload: any = {
          name: projectName,
          project: vercelProjectId, // CRITICAL: Link to existing project
          projectSettings: {
            framework,
            buildCommand: "npm run build",
            installCommand: "npm install",
            outputDirectory: "dist",
          },
          files: vercelFiles,
          target: "production",
        };

        const url = new URL("https://api.vercel.com/v13/deployments");
        if (teamId) url.searchParams.set("teamId", teamId);

        const createRes = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!createRes.ok) {
          const errorText = await createRes.text();
          send({
            type: "error",
            message: `Vercel API error: ${errorText}`,
          });
          controller.close();
          return;
        }

        const created = await createRes.json();
        const deploymentId = created.id as string;
        const productionUrl = `https://${projectName}.vercel.app`;
        // Vercel provides a unique URL for each deployment (e.g., projectname-abc123.vercel.app)
        const uniqueDeploymentUrl = created.url
          ? `https://${created.url}`
          : null;

        // Store deployment record in database
        let dbDeploymentId: string | null = null;

        if (conversationId) {
          try {
            dbDeploymentId = await deploymentService.createDeployment(
              conversationId,
              userId,
              "vercel",
              productionUrl,
              deploymentId,
              {
                environment: "production",
                branch: "main",
                vercelProjectId: vercelProjectId,
                versionId: versionId,
                uniqueDeploymentUrl: uniqueDeploymentUrl || undefined,
                snapshotData: {
                  files: files.map((f) => ({
                    path: f.path,
                    content: f.content,
                  })),
                  projectName: projectName,
                  framework: framework,
                  buildCommand: "npm run build",
                  installCommand: "npm install",
                  outputDirectory: "dist",
                },
              },
            );
          } catch (error) {
            console.error("Failed to store deployment record:", error);
          }
        }

        send({ type: "created", deploymentId, url: null });

        // Poll for status
        send({
          type: "status",
          stage: "building",
          message: "Building on Vercel...",
        });

        let ready = false;
        const statusUrl = `https://api.vercel.com/v13/deployments/${deploymentId}${
          teamId ? `?teamId=${teamId}` : ""
        }`;

        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 2000));

          const statusRes = await fetch(statusUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!statusRes.ok) continue;

          const statusJson: any = await statusRes.json();
          const state: string = statusJson.readyState;

          // Pick the cleanest production alias from Vercel's API
          // Look for the alias that matches our project name exactly (no extra identifiers)
          let actualProductionUrl = productionUrl;
          if (statusJson.alias && statusJson.alias.length > 0) {
            // Find the cleanest alias - the one that matches our expected project name pattern
            const cleanAlias = statusJson.alias.find((alias: string) => {
              return alias === `${projectName}.vercel.app`;
            });
            if (cleanAlias) {
              actualProductionUrl = cleanAlias;
            } else {
              // Fallback to first alias if exact match not found
              actualProductionUrl = statusJson.alias[0];
            }
          }

          // Only send URL when deployment is READY, otherwise send null
          let urlToSend = null;
          if (state === "READY") {
            const urlWithProtocol = actualProductionUrl.startsWith("http")
              ? actualProductionUrl
              : `https://${actualProductionUrl}`;
            urlToSend = urlWithProtocol;
          }

          send({ type: "progress", readyState: state, url: urlToSend });

          if (state === "READY") {
            if (dbDeploymentId) {
              try {
                // Use Vercel's actual production alias if available, ensure it has protocol
                const actualProductionUrl =
                  statusJson.alias?.[0] || productionUrl;
                const urlWithProtocol = actualProductionUrl.startsWith("http")
                  ? actualProductionUrl
                  : `https://${actualProductionUrl}`;
                // Get the unique deployment URL (specific to this deployment)
                // Vercel returns this in the 'url' field - it's the deployment-specific URL
                // Format: projectname-hash-teamname.vercel.app or similar
                let uniqueUrl: string | null = null;
                if (statusJson.url) {
                  uniqueUrl = statusJson.url.startsWith("http")
                    ? statusJson.url
                    : `https://${statusJson.url}`;
                }
                // Log for debugging
                console.log("Vercel deployment ready:", {
                  deploymentId,
                  productionUrl: urlWithProtocol,
                  uniqueUrl,
                  rawUrl: statusJson.url,
                  aliases: statusJson.alias,
                });
                await deploymentService.updateDeploymentStatus(
                  dbDeploymentId,
                  "success",
                  {
                    environment: "production",
                    branch: "main",
                    deploymentUrl: urlWithProtocol,
                    uniqueDeploymentUrl: uniqueUrl || undefined,
                    vercelProjectId: vercelProjectId,
                  },
                );
              } catch (error) {
                console.error("Failed to update deployment status:", error);
              }
            }
            ready = true;
            break;
          }

          if (state === "ERROR" || state === "CANCELED") {
            if (dbDeploymentId) {
              try {
                await deploymentService.updateDeploymentStatus(
                  dbDeploymentId,
                  "failed",
                );
              } catch (error) {
                console.error("Failed to update deployment status:", error);
              }
            }
            send({ type: "error", message: `Deployment ${state}` });
            controller.close();
            return;
          }
        }

        if (ready) {
          // Get the final deployment data to get the actual production alias
          const finalStatusRes = await fetch(statusUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });

          let finalUrl = productionUrl;
          if (finalStatusRes.ok) {
            const finalStatusJson = await finalStatusRes.json();
            finalUrl = finalStatusJson.alias?.[0] || productionUrl;
          }

          // Ensure final URL has protocol
          const finalUrlWithProtocol = finalUrl.startsWith("http")
            ? finalUrl
            : `https://${finalUrl}`;
          send({ type: "complete", url: finalUrlWithProtocol });
        } else {
          if (dbDeploymentId) {
            try {
              await deploymentService.updateDeploymentStatus(
                dbDeploymentId,
                "failed",
              );
            } catch (error) {
              console.error("Failed to update deployment status:", error);
            }
          }
          send({
            type: "error",
            message: "Timed out waiting for Vercel deployment",
          });
        }
      } catch (e: any) {
        send({ type: "error", message: e?.message || String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
