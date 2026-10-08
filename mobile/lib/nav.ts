import { router, type Href } from "expo-router";

export function goBack(fallback: Href = "/(tabs)") {
  if (typeof router.canDismiss === "function" && router.canDismiss()) {
    router.dismiss();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
