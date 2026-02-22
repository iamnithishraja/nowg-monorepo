/**
 * Publish custom metrics to AWS CloudWatch.
 * Used to report active streaming connection count per ECS task (sum in CloudWatch = total).
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
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

const DEFAULT_NAMESPACE = "Nowgai/Web";
const DEFAULT_METRIC_NAME = "ActiveStreamConnections";

/**
 * Publish current active stream connection count to CloudWatch.
 * No-op if AWS_REGION is not set. Safe to call from a timer.
 */
export async function publishActiveConnections(count: number): Promise<void> {
  const cw = getClient();
  if (!cw) return;

  const namespace = getEnvWithDefault(
    "CLOUDWATCH_METRIC_NAMESPACE",
    DEFAULT_NAMESPACE
  );
  const serviceName = getEnvWithDefault("WEB_ECS_SERVICE_NAME", "web");
  const clusterName = getEnvWithDefault("WEB_ECS_CLUSTER_NAME", "default");
  const dimensions = [
    { Name: "Service", Value: serviceName },
    { Name: "Cluster", Value: clusterName },
  ].filter((d) => d.Value);
  const timestamp = new Date();

  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: [
          {
            MetricName: DEFAULT_METRIC_NAME,
            Value: count,
            Unit: "Count",
            Timestamp: timestamp,
            Dimensions: dimensions,
          },
        ],
      })
    );
    console.log(
      "[CloudWatch] Pushed metric:",
      JSON.stringify({
        metric: DEFAULT_METRIC_NAME,
        connections: count,
        namespace,
        dimensions: Object.fromEntries(
          dimensions.map((d) => [d.Name, d.Value])
        ),
        timestamp: timestamp.toISOString(),
      })
    );
  } catch (err) {
    console.error("[CloudWatch] Failed to put metric:", err);
  }
}
