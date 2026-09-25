import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../i18n/LanguageProvider.js";
import { GradeBadge, JourneyStepper, SlaChip } from "./extras.js";

const wrap = (node: React.ReactNode) => render(<LanguageProvider>{node}</LanguageProvider>);

describe("SlaChip", () => {
  it("says how late an overdue issue is, and stays quiet once someone has acted", () => {
    const { unmount } = wrap(<SlaChip sla={{ due_at: "2026-01-01T00:00:00Z", state: "overdue", days_left: -13 }} />);
    expect(screen.getByText(/Overdue by 13d/)).toBeTruthy();
    unmount();
    wrap(<SlaChip sla={{ due_at: "2026-01-01T00:00:00Z", state: "met", days_left: null }} />);
    expect(screen.getByText("Acted on")).toBeTruthy();
  });

  it("warns before the deadline", () => {
    wrap(<SlaChip sla={{ due_at: "2026-01-01T00:00:00Z", state: "due_soon", days_left: 2 }} />);
    expect(screen.getByText("Due in 2d")).toBeTruthy();
  });
});

describe("GradeBadge", () => {
  it("is readable by screen readers", () => {
    wrap(<GradeBadge grade="B" />);
    expect(screen.getByLabelText("Grade B")).toBeTruthy();
  });
});

describe("JourneyStepper", () => {
  it("marks earlier stages done and the current one active", () => {
    const stages = ["received", "understood", "verified", "funded", "fixed"];
    const labels = Object.fromEntries(stages.map((s) => [s, s]));
    const { container } = wrap(<JourneyStepper stages={stages} current="verified" labels={labels} />);
    const steps = container.querySelectorAll("li");
    expect(steps).toHaveLength(5);
    expect(steps[0].querySelector("svg")).toBeTruthy(); // check icon on a completed step
    expect(steps[2].textContent).toContain("3"); // current step still shows its number
    expect(steps[4].textContent).toContain("5"); // future step
  });
});
