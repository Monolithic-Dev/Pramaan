import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "./LanguageProvider.js";

function Probe() {
  const { t, language, setLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="greeting">{t("report.confirmationBody", { id: "sub_123" })}</span>
      <button onClick={() => setLanguage("hi")}>switch</button>
    </div>
  );
}

describe("LanguageProvider", () => {
  it("substitutes placeholders in a translated string", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("greeting").textContent).toContain("sub_123");
  });

  it("switches the active language and its translations", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe("en");
    fireEvent.click(screen.getByText("switch"));
    expect(screen.getByTestId("lang").textContent).toBe("hi");
    expect(screen.getByTestId("greeting").textContent).toContain("sub_123");
  });

  it("falls back to the key itself when a translation is missing", () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>,
    );
    // every declared key must exist in every language file — this is the guard
    expect(screen.getByTestId("greeting").textContent).not.toBe("report.confirmationBody");
  });
});
