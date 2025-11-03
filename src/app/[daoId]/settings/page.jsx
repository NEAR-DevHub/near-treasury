"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Thresholds from "./Thresholds";
import VotingDurationPage from "./VotingDurationPage";
import Theme from "./Theme";
import Preferences from "./Preferences";
import SettingsFeed from "./feed";
import Members from "./Members";

const SettingsPage = () => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "pending-requests";

  const [leftNavbarOptions] = useState([
    {
      title: "Pending Requests",
      key: "pending-requests",
      href: "pending-requests",
    },
    {
      title: "Members",
      key: "members",
      href: "members",
    },
    {
      title: "Voting Thresholds",
      key: "voting-thresholds",
      href: "voting-thresholds",
    },
    {
      title: "Voting Duration",
      key: "voting-duration",
      href: "voting-duration",
    },
    {
      title: "Theme & Logo",
      key: "theme-logo",
      href: "theme-logo",
    },
    {
      title: "Preferences",
      key: "preferences",
      href: "preferences",
    },
  ]);

  const activeContent = useMemo(() => {
    switch (tab) {
      case "pending-requests":
      case "history":
        return <SettingsFeed />;
      case "members":
        return <Members />;
      case "voting-thresholds":
        return <Thresholds />;
      case "voting-duration":
        return <VotingDurationPage />;
      case "theme-logo":
        return <Theme />;
      case "preferences":
        return <Preferences />;
      default:
        return <div>Coming Soon</div>;
    }
  }, [tab]);

  return (
    <div className="d-flex gap-2 flex-wrap flex-md-nowrap text-color mt-4">
      {/* Sidebar */}
      <div
        className="flex-1 mx-2"
        style={{ minWidth: "200px", height: "max-content" }}
      >
        <div className="d-flex gap-2 flex-column">
          {leftNavbarOptions.map((option) => {
            const isActive =
              option.key === "pending-requests"
                ? tab === "pending-requests" || tab === "history"
                : tab === option.key;

            return (
              <div key={option.title} data-testid={option.title}>
                <Link
                  href={`?tab=${option.key}`}
                  className={`link d-inline-flex gap-2 p-2 px-3 rounded-3 pointer w-100 ${
                    isActive ? "bg-grey-035" : ""
                  }`}
                  style={{ textDecoration: "none" }}
                >
                  <div>{option.title}</div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-5 text-color" style={{ minWidth: "200px" }}>
        <div className="w-100 h-100">{activeContent}</div>
      </div>
    </div>
  );
};

export default SettingsPage;
