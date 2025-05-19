import { Badge } from "@filc/ui/components/badge";
import { Skeleton } from "@filc/ui/components/skeleton";
import dayjs from "dayjs";
import { useEffect, useState } from "preact/hooks";
import { FaGithub } from "react-icons/fa6";
import { useLanguage } from "../lib/language";

const GithubTicker = () => {
  const [lastCommit, setLastCommit] = useState<{
    date: dayjs.Dayjs;
    user: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { get, language } = useLanguage();

  const fetchLastCommit = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "https://api.github.com/repos/filcdev/filc/commits?sha=development&per_page=1",
      );
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      const data = await response.json();
      setLastCommit({
        date: dayjs(data[0].commit.author.date),
        user: data[0].commit.author.name,
      });
    } catch (_err) {
      setError("Failed to fetch last commit");
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    fetchLastCommit();
  }, [language]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-32" />
        <Badge variant="destructive" className="h-4 w-24">
          {error}
        </Badge>
      </div>
    );
  }

  if (!lastCommit) {
    return null;
  }

  return (
    <div className="flex flex-col px-4 md:px-0 md:flex-row items-center gap-2 mb-4">
      <FaGithub className="text-xl text-gray-600" />
      <span className="text-sm text-gray-600">
        {get("github", {
          time: lastCommit.date.fromNow(),
          user: lastCommit.user,
        })}
      </span>
    </div>
  );
};

export default GithubTicker;
