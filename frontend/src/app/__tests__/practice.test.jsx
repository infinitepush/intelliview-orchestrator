import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/lib/api";
import PracticePage from "../practice/page";

const BANK_RESPONSE = {
  count: 4,
  questions: [
    {
      question_id: "q_1",
      text: "Describe your experience with distributed systems.",
      category: "technical",
      tags: ["systems"],
    },
    {
      question_id: "q_2",
      text: "How would you design a rate limiter for a public API?",
      category: "technical",
      tags: [],
    },
    {
      question_id: "q_3",
      text: "Tell me about a time you disagreed with a teammate.",
      category: "behavioral",
      tags: ["teamwork"],
    },
    {
      question_id: "q_4",
      text: "Design a URL shortener.",
      category: "technical",
      tags: ["company:Google"],
    },
  ],
};

describe("Practice Page", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("loads questions from the GET /questions endpoint", async () => {
    api.get.mockResolvedValue(BANK_RESPONSE);
    render(<PracticePage />);

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(api.get.mock.calls[0][0]).toMatch(/^\/questions/);
  });

  it("shows real question bank questions for the selected group", async () => {
    api.get.mockResolvedValue(BANK_RESPONSE);
    render(<PracticePage />);

    // Groups are sorted alphabetically: Behavioral, Google, Technical
    expect(
      await screen.findByText("Tell me about a time you disagreed with a teammate.")
    ).toBeInTheDocument();
  });

  it("switches questions when a different option is selected", async () => {
    api.get.mockResolvedValue(BANK_RESPONSE);
    render(<PracticePage />);

    await screen.findByText("Tell me about a time you disagreed with a teammate.");

    fireEvent.change(screen.getByLabelText(/select target company/i), {
      target: { value: "Technical" },
    });

    expect(
      screen.getByText("Describe your experience with distributed systems.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("How would you design a rate limiter for a public API?")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Tell me about a time you disagreed with a teammate.")
    ).not.toBeInTheDocument();
  });

  it("uses a company:<name> tag as the company when present", async () => {
    api.get.mockResolvedValue(BANK_RESPONSE);
    render(<PracticePage />);

    await screen.findByText("Tell me about a time you disagreed with a teammate.");

    fireEvent.change(screen.getByLabelText(/select target company/i), {
      target: { value: "Google" },
    });

    expect(screen.getByText("Design a URL shortener.")).toBeInTheDocument();
  });

  it("does not render the old hard-coded mock questions", async () => {
    api.get.mockResolvedValue(BANK_RESPONSE);
    render(<PracticePage />);

    await screen.findByText("Tell me about a time you disagreed with a teammate.");

    expect(screen.queryByText(/Invert a binary tree in place/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Meta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Amazon" })).not.toBeInTheDocument();
  });

  it("shows an error with retry when the request fails", async () => {
    api.get.mockRejectedValueOnce(new Error("GET /questions failed (500): boom"));
    api.get.mockResolvedValueOnce(BANK_RESPONSE);
    render(<PracticePage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/failed \(500\)/i);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(
      await screen.findByText("Tell me about a time you disagreed with a teammate.")
    ).toBeInTheDocument();
  });

  it("shows the empty state when the bank has no questions", async () => {
    api.get.mockResolvedValue({ count: 0, questions: [] });
    render(<PracticePage />);

    expect(
      await screen.findByText(/no questions available for this company/i)
    ).toBeInTheDocument();
  });
});