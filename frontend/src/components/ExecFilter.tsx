import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export type ExecPerson = { id: number; name: string };
export type ExecValue = "all" | "unassigned" | number;

export function useExecutives() {
  const { accessToken } = useAuth();
  const [people, setPeople] = useState<ExecPerson[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    api<{ id: number; name: string; roles: string[] }[]>("/users", { token: accessToken })
      .then((rows) =>
        setPeople(
          rows
            .filter((row) => row.roles.includes("SALES_EXECUTIVE"))
            .map((row) => ({ id: row.id, name: row.name })),
        ),
      )
      .catch(() => undefined);
  }, [accessToken]);

  return people;
}

export function ExecFilter({
  people,
  value,
  onChange,
  includeUnassigned = false,
}: {
  people: ExecPerson[];
  value: ExecValue;
  onChange: (next: ExecValue) => void;
  includeUnassigned?: boolean;
}) {
  return (
    <select
      className="exec-select"
      aria-label="Sales executive"
      value={value === "all" ? "all" : String(value)}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === "all") onChange("all");
        else if (raw === "unassigned") onChange("unassigned");
        else onChange(Number(raw));
      }}
    >
      <option value="all">All executives</option>
      {includeUnassigned ? <option value="unassigned">Unassigned</option> : null}
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ))}
    </select>
  );
}
