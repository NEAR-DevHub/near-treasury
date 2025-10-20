"use client";

import * as HoverCard from "@radix-ui/react-hover-card";

const Tooltip = ({ tooltip, children, placement = "top" }) => {
  return (
    <HoverCard.Root openDelay={50}>
      <HoverCard.Trigger asChild>
        {children ? (
          <span>{children}</span>
        ) : (
          <i className="bi bi-info-circle text-secondary" />
        )}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="HoverCardContent"
          sideOffset={5}
          side={placement}
        >
          {tooltip}
          <HoverCard.Arrow className="HoverCardArrow" />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
};

export default Tooltip;
