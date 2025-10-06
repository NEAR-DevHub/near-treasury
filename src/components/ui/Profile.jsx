"use client";

import { useState, useEffect } from "react";
import Tooltip from "@/components/ui/Tooltip";
import Copy from "./Copy";

const Profile = ({
  accountId,
  displayName = true,
  displayImage = true,
  profileClass = "",
  displayAddress = true,
  imageSize = { width: 35, height: 35 },
  displayHoverCard = true,
}) => {
  const [profile, setProfile] = useState(null);

  const imageSrc = `https://i.near.social/magic/large/https://near.social/magic/img/account/${accountId}`;
  const name = profile?.name;

  //   useEffect(() => {
  // setProfile({ name: accountId });
  //   }, [accountId]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const HoverCard = () => (
    <div style={{ width: 200 }} className="py-1">
      <div className="d-flex flex-column gap-2">
        <div className="d-flex gap-2 align-items-center">
          <img
            src={imageSrc}
            height={40}
            width={40}
            className="rounded-circle"
            alt={name}
          />
          <div className="d-flex flex-column gap-1">
            <div className="h6 mb-0">{name}</div>
            <div className="text-break">@{accountId}</div>
          </div>
        </div>
        <div
          className="border-top d-flex pt-2 flex-column"
          style={{ gap: "0.7rem" }}
        >
          <a
            onClick={(e) => e.stopPropagation()}
            target="_blank"
            rel="noopener noreferrer"
            href={`https://near.social/mob.near/widget/ProfilePage?accountId=${accountId}`}
            className="d-flex gap-2 align-items-center text-decoration-none"
          >
            <i className="bi bi-person h4 mb-0"></i>
            Open Profile
          </a>

          <Copy
            className="d-flex gap-2 align-items-center text-decoration-none"
            label="Copy wallet address"
            showLogo={true}
            clipboardText={accountId}
            copyLogoClass="h5 mb-0"
            checkLogoClass="h6 mb-0"
          />
        </div>
      </div>
    </div>
  );

  const ProfileComponent = (
    <div className="d-flex gap-2 align-items-center" style={{ minWidth: 0 }}>
      {displayImage && (
        <div
          style={{
            flex: "0 0 auto",
            width: imageSize.width,
            height: imageSize.height,
            position: "relative",
          }}
        >
          <img
            src={imageSrc}
            height={imageSize.height}
            width={imageSize.width}
            className="rounded-circle"
            alt={name}
          />
        </div>
      )}

      <div className="d-flex flex-column" style={{ minWidth: 0, flex: 1 }}>
        {displayName && (
          <div className="mb-0 text-truncate" title={name}>
            {name}
          </div>
        )}
        {displayAddress && (
          <div
            className={`text-truncate ${profileClass}`}
            title={accountId}
            style={{
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {displayName ? "@" + accountId : accountId}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {displayHoverCard ? (
        <Tooltip tooltip={<HoverCard />} placement="bottom">
          {ProfileComponent}
        </Tooltip>
      ) : (
        ProfileComponent
      )}
    </div>
  );
};

export default Profile;
