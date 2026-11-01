import { router, type Href } from "expo-router";

/** Leave the current screen only. Do not dismiss the whole stack. */
export function goBack(fallback: Href = "/(tabs)") {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // Some web embeds cannot ask the navigator; fall through to the fallback screen.
  }
  router.replace(fallback);
}
