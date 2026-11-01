import { useState } from "react";
import { ExecFilter, useExecutives, type ExecValue } from "@/components/exec-filter";
import { VisitHistory } from "@/components/visit-history";
import { Screen, ScreenHeader } from "@/components/ui";

export default function ProofScreen() {
  const { people } = useExecutives();
  const [exec, setExec] = useState<ExecValue>("all");

  return (
    <Screen
      header={
        <ScreenHeader
          title="Visit proof"
          subtitle="Place photo + GPS · same proof as the desk portal. Tap a visit to open."
          back
          fallback="/(tabs)/more"
        />
      }
    >
      <ExecFilter people={people} value={exec} onChange={setExec} />
      <VisitHistory userId={typeof exec === "number" ? exec : undefined} showPerson />
    </Screen>
  );
}
