import {
  Building2,
  FileText,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { redirect, useNavigate } from "react-router";
import { Header } from "../components";
import Background from "../components/Background";
import { ProjectSidebar } from "../components/ProjectSidebar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Label } from "../components/ui/label";
import { auth } from "../lib/auth";

export async function loader({ request }: LoaderFunctionArgs) {
  const authInstance = await auth;
  const session = await authInstance.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    throw redirect("/");
  }

  return { user: session.user };
}

const PageShell = ({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) => (
  <div className="h-screen w-screen bg-canvas text-primary flex overflow-hidden">
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <Background />
      <div className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
        <div
          className="absolute left-0 top-1/4 h-[40rem] w-[80rem] rotate-[12deg] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(50% 60% at 50% 50%, rgba(123, 76, 255, 0.08) 0%, rgba(123, 76, 255, 0.06) 45%, rgba(123, 76, 255, 0.04) 100%)",
            mixBlendMode: "screen",
          }}
        />
        <div
          className="absolute right-0 top-1/2 h-[36rem] w-[70rem] -rotate-[8deg] rounded-full blur-[70px]"
          style={{
            background:
              "radial-gradient(55% 65% at 50% 50%, rgba(140, 99, 242, 0.06) 0%, rgba(140, 99, 242, 0.04) 50%, rgba(140, 99, 242, 0.02) 100%)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    </div>
    <ProjectSidebar user={user} className="flex-shrink-0" />
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header showSidebarToggle={false} showAuthButtons={false} />
      <main className="relative z-20 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col items-center pt-8 sm:pt-12 pb-8">
          <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 md:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  </div>
);

export default function ReviewDocs({
  loaderData,
}: {
  loaderData?: { user?: any };
}) {
  const user = loaderData?.user;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Document requirement & upload state
  const [documentRequirements, setDocumentRequirements] = useState<any[]>([]);
  const [documentSubmissions, setDocumentSubmissions] = useState<any[]>([]);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File>>({});

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user-organizations", {
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          navigate("/signin");
          return;
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.enterpriseRequest && data.enterpriseRequest.approvalStatus === "rejected") {
        setOrgId(data.enterpriseRequest.id);
        await fetchDocumentRequirements(data.enterpriseRequest.id);
      } else if (data.enterpriseRequest && data.enterpriseRequest.approvalStatus === "pending") {
        setOrgId(data.enterpriseRequest.id);
        await fetchDocumentRequirements(data.enterpriseRequest.id);
      } else {
         setError("No pending/rejected enterprise request found to review documents for.");
      }
    } catch (err) {
      console.error("Error determining view:", err);
    }
    setLoading(false);
  };

  const fetchDocumentRequirements = async (organizationId: string) => {
    try {
      const url = `/api/organizations/documents?organizationId=${organizationId}`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setDocumentRequirements(data.requirements || []);
        setDocumentSubmissions(data.submissions || []);
      }
    } catch (err) {
      console.error("Failed to fetch document requirements", err);
    }
  };

  const handleSubmitDocuments = async () => {
    if (!orgId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      for (const [reqId, file] of Object.entries(documentFiles)) {
        // 1. Get presigned URL
        const presignedRes = await fetch("/api/organizations/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "getPresignedUploadUrl",
            fileName: file.name,
            contentType: file.type,
          }),
        });
        const presignedData = await presignedRes.json();
        if (!presignedRes.ok) throw new Error(presignedData.error);
        
        // 2. Upload to R2
        const uploadRes = await fetch(presignedData.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`Failed to upload file ${file.name}.`);

        // 3. Save submission
        const submitRes = await fetch("/api/organizations/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "submitDocument",
            organizationId: orgId,
            requirementId: reqId,
            fileUrl: presignedData.publicUrl,
          }),
        });
        const submitData = await submitRes.json();
        if (!submitRes.ok) throw new Error(submitData.error);
      }

      await fetchDocumentRequirements(orgId);
      setDocumentFiles({});
      navigate("/manage-org/convo"); // back to manage-org status page
    } catch (err: any) {
      console.error("Error submitting documents:", err);
      setError(err.message || "Failed to submit documents");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageShell user={user}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#7b4cff]" />
        </div>
      </PageShell>
    );
  }

  // Filter out the requirements that actually have a rejected submission (or all if we want to allow reubmitting pending, but let's focus on rejected)
  const rejectedRequirements = documentRequirements.filter(req => {
     const sub = documentSubmissions.find(s => s.requirementId === req._id);
     return sub?.status === "rejected";
  });

  return (
    <PageShell user={user}>
      <div className="rounded-[12px] bg-surface-1 border border-[#7b4cff]/30 w-full">
        <Card className="bg-transparent border-0 shadow-none">
          <CardHeader className="px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-5 w-5 text-[#7b4cff]" />
              <CardTitle className="text-primary">
                Review Rejected Documents
              </CardTitle>
            </div>
            <CardDescription className="text-secondary">
              The administrator has reviewed your documents and requested changes. 
              Please upload the new files for the rejected documents below.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm border border-red-500/20">
                {error}
              </div>
            )}
            
            {rejectedRequirements.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-secondary">No rejected documents found to review.</p>
                    <Button onClick={() => navigate("/manage-org/convo")} className="mt-4">
                        Go back
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 pt-4">
                  <div className="space-y-3">
                    {rejectedRequirements.map((req) => {
                      const existingSub = documentSubmissions.find(s => s.requirementId === req._id);
                      const selectedFile = documentFiles[req._id];

                      return (
                        <div key={req._id} className="p-4 rounded-lg bg-surface-2 border border-red-500/30">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-tertiary" />
                                <span className="text-primary font-medium">{req.name}</span>
                                {req.isMandatory && <span className="text-red-400 text-xs">*Required</span>}
                              </div>
                              {req.description && (
                                <p className="text-sm text-secondary mt-1">{req.description}</p>
                              )}
                              
                              {/* Rejection Note */}
                              {existingSub?.adminNotes && !selectedFile && (
                                <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                                  <p className="text-sm text-red-400 font-medium">Changes Requested:</p>
                                  <p className="text-sm text-red-300">{existingSub.adminNotes}</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Upload Area */}
                            <div className="ml-4 flex-shrink-0">
                               {selectedFile ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-secondary max-w-[150px] truncate">{selectedFile.name}</span>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => {
                                      const newFiles = { ...documentFiles };
                                      delete newFiles[req._id];
                                      setDocumentFiles(newFiles);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div>
                                  <input 
                                    type="file" 
                                    id={`doc-${req._id}`} 
                                    className="hidden" 
                                    onChange={(e) => {
                                      if (e.target.files?.[0]) {
                                        setDocumentFiles({ ...documentFiles, [req._id]: e.target.files[0] });
                                      }
                                    }}
                                  />
                                  <Label 
                                    htmlFor={`doc-${req._id}`}
                                    className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background border border-subtle hover:bg-subtle hover:text-primary h-9 px-4 py-2"
                                  >
                                    <UploadCloud className="h-4 w-4 mr-2" />
                                    Re-upload
                                  </Label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <Button
                        onClick={handleSubmitDocuments}
                        disabled={isSubmitting || Object.keys(documentFiles).length === 0}
                        className="bg-[#7b4cff] hover:bg-[#8c63f2] text-white"
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Uploaded Documents
                    </Button>
                  </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
