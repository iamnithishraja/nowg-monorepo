import { MicroserviceConfigComponent } from "@/components/microservice-config";
import { SiGithub } from "react-icons/si";

export default function GitPage() {
  return (
    <MicroserviceConfigComponent
      service={{
        name: "GitHub",
        icon: SiGithub,
        description: "Version control and collaboration platform",
        color: "text-black dark:text-white",
        bgColor: "bg-black/5 dark:bg-white/5",
        docs: "https://docs.github.com",
      }}
    />
  );
}
