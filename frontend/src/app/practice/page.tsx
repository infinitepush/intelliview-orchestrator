"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

interface BankQuestion {
  question_id?: string;
  text?: string;
  category?: string;
  company?: string;
  tags?: string[] | null;
}

interface QuestionsResponse {
  count?: number;
  questions?: BankQuestion[];
}

const GENERAL_GROUP = "General";

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Work out which "company" a question belongs to.
 * The question bank API has no dedicated company field, so we use, in order:
 *   1. an explicit `company` field, if the API ever returns one
 *   2. a `company:<name>` tag (e.g. "company:Google")
 *   3. the question's category (technical, behavioral, ...) as a fallback,
 *      so every question in the bank is still reachable from the selector.
 */
function getGroupName(question: BankQuestion): string {
  if (question.company && question.company.trim()) {
    return question.company.trim();
  }

  const companyTag = (question.tags || []).find((tag) =>
    tag.toLowerCase().startsWith("company:")
  );
  if (companyTag) {
    const name = companyTag.slice("company:".length).trim();
    if (name) return name;
  }

  if (question.category && question.category.trim()) {
    return toTitleCase(question.category.trim());
  }

  return GENERAL_GROUP;
}

export default function PracticePage() {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data: QuestionsResponse = await api.get("/questions?limit=100");
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load questions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const questionsByCompany = useMemo(() => {
    const groups: Record<string, string[]> = {};
    questions.forEach((question) => {
      const text = (question.text || "").trim();
      if (!text) return;
      const group = getGroupName(question);
      if (!groups[group]) groups[group] = [];
      groups[group].push(text);
    });
    return groups;
  }, [questions]);

  const companies = useMemo(
    () => Object.keys(questionsByCompany).sort((a, b) => a.localeCompare(b)),
    [questionsByCompany]
  );

  // Default to the first group once data arrives, and recover if the
  // current selection disappears after a reload.
  useEffect(() => {
    if (companies.length > 0 && !companies.includes(selectedCompany)) {
      setSelectedCompany(companies[0]);
    }
  }, [companies, selectedCompany]);

  const currentQuestions = questionsByCompany[selectedCompany] || [];

  return (
    <main className="max-w-4xl mx-auto p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Practice</h1>
        <p className="text-gray-600">
          Select a company to view tailored practice questions from the question bank.
        </p>
      </header>

      {/* Company Selector */}
      <section className="mb-8">
        <label htmlFor="company-select" className="block text-sm font-medium text-gray-700 mb-2">
          Select Target Company
        </label>
        <select
          id="company-select"
          value={selectedCompany}
          onChange={(e) => setSelectedCompany(e.target.value)}
          disabled={loading || companies.length === 0}
          className="w-full md:w-1/2 p-2.5 border border-gray-300 rounded-md shadow-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
        >
          {companies.map((company) => (
            <option key={company} value={company}>
              {company}
            </option>
          ))}
        </select>
      </section>

      {/* Questions List */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-800">
          {selectedCompany ? `${selectedCompany} Questions` : "Questions"}
        </h2>

        {loading ? (
          <div
            role="status"
            className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-500"
          >
            Loading questions...
          </div>
        ) : error ? (
          <div
            role="alert"
            className="p-4 bg-red-50 rounded-lg border border-red-200 text-red-700"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={loadQuestions}
              className="mt-2 text-sm font-medium underline"
            >
              Retry
            </button>
          </div>
        ) : currentQuestions.length > 0 ? (
          <ul className="space-y-3">
            {currentQuestions.map((question, index) => (
              <li
                key={`${selectedCompany}-${index}`}
                className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm text-gray-800"
              >
                {question}
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">
            No questions available for this company.
          </div>
        )}
      </section>
    </main>
  );
}