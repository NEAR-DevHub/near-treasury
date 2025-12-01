// Google Analytics utility functions

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

// Check if GA is enabled
export const isGAEnabled = Boolean(GA_MEASUREMENT_ID);

// Page view tracking
export const pageview = (url) => {
  if (!isGAEnabled) return;

  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: url,
  });
};

// Custom event tracking
export const event = ({ action, category, label, value, params = {} }) => {
  if (!isGAEnabled) return;

  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value: value,
    ...params,
  });
};

// Track DAO page visits
export const trackDaoVisit = (daoId, pathname, pageType) => {
  if (!isGAEnabled) return;

  event({
    action: "dao_visit",
    category: "DAO",
    label: daoId,
    params: {
      dao_id: daoId,
      page_type: pageType,
      page_path: pathname,
    },
  });
};

// Set user properties
export const setUserProperties = (properties) => {
  if (!isGAEnabled) return;

  window.gtag("set", "user_properties", properties);
};

// Track specific DAO as user property for session tracking
export const setCurrentDao = (daoId) => {
  if (!isGAEnabled) return;

  setUserProperties({
    current_dao: daoId,
  });
};
