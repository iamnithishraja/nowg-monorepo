/**
 * Publish custom metrics to AWS CloudWatch.
 * Used to report active streaming connection count per ECS task (sum in CloudWatch = total).
 */

import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { getEnvWithDefault } from "./env";

let client: CloudWatchClient | null = null;

function getClient(): CloudWatchClient | null {
  if (client) return client;
  // Prefer AWS_REGION; ECS often sets AWS_DEFAULT_REGION
  const region =
    getEnvWithDefault("AWS_REGION", "") ||
    process.env.AWS_REGION ||
    process.env.AWS_DEFAULT_REGION ||
    "";
  if (!region) return null;
  try {
    client = new CloudWatchClient({ region });
    return client;
  } catch {
    return null;
  }
}

const DEFAULT_NAMESPACE = "NowGai/Web";
const DEFAULT_METRIC_NAME = "ActiveStreamConnections";

/**
 * Publish current active stream connection count to CloudWatch.
 * No-op if AWS_REGION is not set. Safe to call from a timer.
 */
export async function publishActiveConnections(count: number): Promise<void> {
  const cw = getClient();
  if (!cw) return;

  const namespace = getEnvWithDefault("CLOUDWATCH_METRIC_NAMESPACE", DEFAULT_NAMESPACE);

  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [
          {
            MetricName: DEFAULT_METRIC_NAME,
            Value: count,
            Unit: "Count",
            Timestamp: new Date(),
            Dimensions: [
              { Name: "Service", Value: getEnvWithDefault("ECS_SERVICE_NAME", "web") },
              { Name: "Cluster", Value: getEnvWithDefault("ECS_CLUSTER_NAME", "default") },
            ].filter((d) => d.Value),
          },
        ],
      })
    );
  } catch (err) {
    console.error("[CloudWatch] Failed to put metric:", err);
  }
}
