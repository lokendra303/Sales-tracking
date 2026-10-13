const { withAndroidManifest } = require("expo/config-plugins");

// Local reminders do not need Firebase. Its startup provider crashes phones
// that have no Google Play services, and phones where google-services.json
// was never added.
function withoutFirebaseInit(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    manifest.manifest.$ = manifest.manifest.$ ?? {};
    manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const application = manifest.manifest.application?.[0];
    if (!application) return config;

    application.provider = application.provider ?? [];
    application.provider.push({
      $: {
        "android:name": "com.google.firebase.provider.FirebaseInitProvider",
        "android:authorities": "${applicationId}.firebaseinitprovider",
        "tools:node": "remove",
      },
    });

    application.service = application.service ?? [];
    application.service.push({
      $: {
        "android:name": "expo.modules.notifications.service.ExpoFirebaseMessagingService",
        "tools:node": "remove",
      },
    });

    return config;
  });
}

module.exports = withoutFirebaseInit;
