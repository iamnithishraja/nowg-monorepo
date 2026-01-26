import { EnvConfig } from "@nowgai/shared/models";
import type { Request, Response } from "express";

const PROTECTED_KEYS = [
  "MONGODB_URI",
  "MONGODB_URL",
  "NODE_ENV",
  "PATH",
  "HOME",
  "USER",
  "SHELL",
  "PWD",
];

export async function getEnvConfigs(req: Request, res: Response) {
  try {
    const envVars = await EnvConfig.find({}).sort({ key: 1 }).lean();

    const envConfigs = envVars
      .filter((env) => !PROTECTED_KEYS.includes(env.key))
      .map((env) => ({
        id: env._id.toString(),
        key: env.key,
        value: env.value,
      }));

    return res.json({ envConfigs });
  } catch (error: any) {
    console.error("Error fetching env configs:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch environment variables" });
  }
}

export async function updateEnvConfigs(req: Request, res: Response) {
  try {
    const { envConfigs } = req.body;

    if (!Array.isArray(envConfigs)) {
      return res.status(400).json({
        error: "Invalid request body. Expected envConfigs array",
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const config of envConfigs) {
      const { key, value } = config;

      if (!key || typeof key !== "string") {
        results.errors.push(`Invalid key: ${key}`);
        continue;
      }

      if (PROTECTED_KEYS.includes(key)) {
        results.errors.push(`Cannot modify protected key: ${key}`);
        continue;
      }

      if (value === undefined || value === null) {
        results.errors.push(`Invalid value for key: ${key}`);
        continue;
      }

      try {
        const result = await EnvConfig.updateOne(
          { key },
          { $set: { value: String(value) } },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          results.created++;
        } else if (result.modifiedCount > 0) {
          results.updated++;
        }
      } catch (error: any) {
        results.errors.push(`Error updating ${key}: ${error.message}`);
      }
    }

    return res.json({
      success: true,
      message: "Environment variables updated successfully",
      results,
    });
  } catch (error: any) {
    console.error("Error updating env configs:", error);
    return res
      .status(500)
      .json({ error: "Failed to update environment variables" });
  }
}

