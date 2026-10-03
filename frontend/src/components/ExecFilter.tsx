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
    <div className="chips" role="tablist" aria-label="Sales executive">
      <button type="button" className={value === "all" ? "chip on" : "chip"} onClick={() => onChange("all")}>
        All executives
      </button>
      {includeUnassigned ? (
        <button
          type="button"
          className={value === "unassigned" ? "chip on" : "chip"}
          onClick={() => onChange("unassigned")}
        >
          Unassigned
        </button>
      ) : null}
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          className={value === person.id ? "chip on" : "chip"}
          onClick={() => onChange(person.id)}
        >
          {person.name}
        </button>
      ))}
    </div>
  );
}
