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

// Helper to get or create Netlify site
async function getOrCreateNetlifySite(
  siteName: string,
  token: string
): Promise<string | null> {
  try {
    // Try to get existing site
    const listRes = await fetch("https://api.netlify.com/api/v1/sites", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (listRes.ok) {
      const sites: any[] = await listRes.json();
      const existing = sites.find((s) => s.name === siteName);
      if (existing) {
        return existing.id;
      }
    }

    // Site doesn't exist, create it
    const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: siteName }),
    });

    if (createRes.ok) {
      const created = await createRes.json();
      return created.id;
    }

    return null;
  } catch (error) {
    console.error("Error getting/creating Netlify site:", error);
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

        // Initialize deployment service early so we can use it for version checks
        const deploymentService = new DeploymentService();

        // If versionId is provided, fetch files from that version
        if (versionId) {
          try {
            // Check if this version is already deployed
            const isAlreadyDeployed = await deploymentService.isVersionDeployed(
              conversationId,
              versionId,
              "netlify"
            );
            if (isAlreadyDeployed) {
              send({
                type: "error",
                message: "This version has already been deployed to Netlify",
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

        // NEW: Create unique site name per conversation
        const siteName = `nowgai-${conversationId}`;

        if (!Array.isArray(files) || files.length === 0) {
          send({ type: "error", message: "No files provided for deployment" });
          controller.close();
          return;
        }

        const token = getEnv("NETLIFY_ACCESS_TOKEN");
        if (!token) {
          send({
            type: "error",
            message: "NETLIFY_ACCESS_TOKEN is not configured on the server",
          });
          controller.close();
          return;
        }

        // NEW: Check if we have an existing deployment for this conversation
        const existingDeployments = await deploymentService.getDeployments(
          conversationId
        );
        const latestDeployment = existingDeployments
          .filter((d: any) => d.platform === "netlify")
          .sort(
            (a: any, b: any) =>
              new Date(b.deployedAt).getTime() -
              new Date(a.deployedAt).getTime()
          )[0];

        send({
          type: "status",
          stage: "creating",
          message: "Preparing Netlify site...",
        });

        // NEW: Get or create Netlify site
        let netlifySiteId = latestDeployment?.netlifySiteId;
        if (!netlifySiteId) {
          netlifySiteId = await getOrCreateNetlifySite(siteName, token);
          if (!netlifySiteId) {
            send({
              type: "error",
              message: "Failed to create or access Netlify site",
            });
            controller.close();
            return;
          }
        }

        send({
          type: "status",
          stage: "uploading",
          message: "Uploading files to Netlify...",
        });

        // Prepare files map for deploy API
        const filesMap: Record<string, string> = {};
        for (const f of files) {
          const path = (f.path || "").replace(/^\/+/, "");
          filesMap[`/${path}`] = Buffer.from(f.content || "").toString(
            "base64"
          );
        }

        // Create deploy to existing site
        const deployRes = await fetch(
          `https://api.netlify.com/api/v1/sites/${netlifySiteId}/deploys`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              files: filesMap,
              async: true,
            }),
          }
        );

        if (!deployRes.ok) {
          const errorText = await deployRes.text();
          send({
            type: "error",
            message: `Netlify API error: ${errorText}`,
          });
          controller.close();
          return;
        }

        const deploy = await deployRes.json();
        const deployId = deploy.id as string;
        const productionUrl = `https://${siteName}.netlify.app`;

        // Store deployment record in database
        let dbDeploymentId: string | null = null;

        if (conversationId) {
          try {
            dbDeploymentId = await deploymentService.createDeployment(
              conversationId,
              userId,
              "netlify",
              productionUrl,
              deployId,
              {
                environment: "production",
                branch: "main",
                netlifySiteId: netlifySiteId,
                versionId: versionId,
              }
            );
          } catch (error) {
            console.error("Failed to store deployment record:", error);
          }
        }

        send({ type: "created", deployId, url: null });

        // Poll for completion
        send({
          type: "status",
          stage: "building",
          message: "Building on Netlify...",
        });

        let ready = false;
        for (let i = 0; i < 120; i++) {
          await new Promise((r) => setTimeout(r, 2000));

          const statusRes = await fetch(
            `https://api.netlify.com/api/v1/deploys/${deployId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (!statusRes.ok) continue;

          const statusJson = await statusRes.json();
          const state = statusJson.state;

          // Only send URL when deployment is ready
          const urlToSend = state === "ready" ? productionUrl : null;
          send({ type: "progress", state: state, url: urlToSend });

          if (state === "ready") {
            if (dbDeploymentId) {
              try {
                await deploymentService.updateDeploymentStatus(
                  dbDeploymentId,
                  "success",
                  {
                    environment: "production",
                    branch: "main",
                    deploymentUrl: productionUrl,
                    netlifySiteId: netlifySiteId,
                  }
                );
              } catch (error) {
                console.error("Failed to update deployment status:", error);
              }
            }
            ready = true;
            break;
          }

          if (state === "error") {
            if (dbDeploymentId) {
              try {
                await deploymentService.updateDeploymentStatus(
                  dbDeploymentId,
                  "failed"
                );
              } catch (error) {
                console.error("Failed to update deployment status:", error);
              }
            }
            send({ type: "error", message: "Netlify deployment error" });
            controller.close();
            return;
          }
        }

        if (ready) {
          send({ type: "complete", url: productionUrl });
        } else {
          if (dbDeploymentId) {
            try {
              await deploymentService.updateDeploymentStatus(
                dbDeploymentId,
                "failed"
              );
            } catch (error) {
              console.error("Failed to update deployment status:", error);
            }
          }
          send({
            type: "error",
            message: "Timed out waiting for Netlify deployment",
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
