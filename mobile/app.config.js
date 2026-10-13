const fs = require("node:fs");
const path = require("node:path");

const servicesFile = "./google-services.json";
const firebaseInit = "./plugins/without-firebase-init.js";

// Firebase delivers lead alerts while the app is closed. A missing or wrong config file makes
// Firebase close the app at start-up, so it stays switched off unless the file matches this app.
function firebaseReady(packageName) {
  const file = path.join(__dirname, servicesFile);
  if (!fs.existsSync(file)) return false;
  let json;
  try {
    json = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    throw new Error("mobile/google-services.json is not valid JSON. Download it again from Firebase.");
  }
  const clients = Array.isArray(json.client) ? json.client : [];
  const match = clients.some((client) => client?.client_info?.android_client_info?.package_name === packageName);
  if (!json.project_info?.project_id || !match) {
    throw new Error(
      `mobile/google-services.json does not include the Android app ${packageName}. Add that app in Firebase and download the file again.`,
    );
  }
  return true;
}

module.exports = ({ config }) => {
  const hasFirebase = firebaseReady(config.android?.package);
  return {
    ...config,
    android: {
      ...config.android,
      ...(hasFirebase ? { googleServicesFile: servicesFile } : {}),
    },
    plugins: (config.plugins ?? []).filter((plugin) => !(hasFirebase && plugin === firebaseInit)),
    extra: {
      ...config.extra,
      remotePush: hasFirebase,
    },
  };
};
