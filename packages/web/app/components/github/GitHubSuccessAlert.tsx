import { Alert } from "../ui/alert";
import type { RepositoryStatus } from "~/types/github";

interface GitHubSuccessAlertProps {
  message: string;
  commitInfo?: {
    sha?: string;
    url?: string;
  } | null;
  repositoryStatus?: RepositoryStatus | null;
}

export function GitHubSuccessAlert({
  message,
  commitInfo,
  repositoryStatus,
}: GitHubSuccessAlertProps) {
  return (
    <Alert className="bg-green-50 text-green-900 border-green-200">
      <div className="flex items-start gap-2">
        <svg
          className="w-5 h-5 text-green-600 mt-0.5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
          {commitInfo && (
            <div className="mt-2 space-y-1">
              {commitInfo.sha && (
                <p className="text-xs text-green-700">
                  Commit:{" "}
                  <code className="bg-green-100 px-1 py-0.5 rounded">
                    {commitInfo.sha.substring(0, 7)}
                  </code>
                </p>
              )}
              {commitInfo.url && repositoryStatus?.repository?.repoUrl && (
                <a
                  href={`${repositoryStatus.repository.repoUrl}/commit/${commitInfo.sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-700 hover:text-green-800 underline inline-flex items-center gap-1"
                >
                  View commit on GitHub
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}

