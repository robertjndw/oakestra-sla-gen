import { createRef, useState, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionContext } from "@/hooks/session-context";
import { initialState, type ComposeFile, type SessionApi, type SessionState } from "@/hooks/use-session";
import { initialAnswers, type QuestionAnswer } from "@/lib/answers";
import type { Clarification } from "@/lib/types";
import { Composer } from "./composer";
import { composerModel, readComposeFile } from "./composer-logic";
import { QuestionForm } from "./question-form";

const questions: Clarification[] = [
  { topic: "ports", question: "Which port?", assumption: "80" },
  { topic: "db", question: "Which database?", assumption: null },
];

function fakeApi(state: Partial<SessionState> = {}): SessionApi {
  const noop = vi.fn();
  return {
    state: { ...initialState(), ...state },
    settingsLocked: !!state.sessionId,
    hasUnacceptedWork: false,
    send: vi.fn().mockResolvedValue(undefined),
    answer: vi.fn().mockResolvedValue(undefined),
    accept: noop,
    keepRefining: noop,
    newSession: noop,
    loadCandidate: noop,
    setEditorText: noop,
    resetToModel: noop,
    setSettings: noop,
    dismissPendingDraft: noop,
  };
}

function Harness({ api, form }: { api: SessionApi; form?: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<ComposeFile | null>(null);
  const answers = initialAnswers(questions);
  return (
    <SessionContext.Provider value={api}>
      <Composer
        text={text}
        onTextChange={setText}
        composeFile={file}
        onComposeFileChange={setFile}
        form={form ? { questions, answers } : null}
        inputRef={createRef()}
      />
    </SessionContext.Provider>
  );
}

const wrap = (n: ReactNode) => render(<>{n}</>);

describe("composerModel", () => {
  const base = { sessionId: null, turnRunning: false, hasModelDraft: false, form: null, text: "", composeFile: null };
  it("cannot send nothing", () => {
    expect(composerModel(base).canSend).toBe(false);
  });
  it("sends a compose file without text", () => {
    expect(composerModel({ ...base, composeFile: { name: "a.yml", text: "x" } }).canSend).toBe(true);
  });
  it("ignores a compose file once a session exists", () => {
    const m = composerModel({ ...base, sessionId: "s", composeFile: { name: "a.yml", text: "x" } });
    expect(m.canSend).toBe(false);
    expect(m.label).toBe("Update draft");
  });
  it("is blocked while a turn runs", () => {
    expect(composerModel({ ...base, text: "hi", turnRunning: true }).canSend).toBe(false);
  });
  it("with an open form, keeps assumptions as an answer and offers Send answers", () => {
    const m = composerModel({
      ...base,
      sessionId: "s",
      form: { questions, answers: initialAnswers(questions) },
    });
    expect(m.label).toBe("Send answers");
    expect(m.message).toBe("");
    expect(m.canSend).toBe(false);
    const typed = composerModel({
      ...base,
      sessionId: "s",
      text: "use tls",
      form: { questions, answers: initialAnswers(questions) },
    });
    expect(typed.canSend).toBe(true);
    expect(typed.message).toContain("Also: use tls");
  });
  it("rejects oversized compose files", async () => {
    const big = new File(["a".repeat(64_001)], "big.yml");
    const res = await readComposeFile(big);
    expect(res.ok).toBe(false);
    const ok = await readComposeFile(new File(["services: {}"], "ok.yml"));
    expect(ok).toEqual({ ok: true, file: { name: "ok.yml", text: "services: {}" } });
  });
});

describe("QuestionForm", () => {
  function Form() {
    const [answers, setAnswers] = useState<QuestionAnswer[]>(initialAnswers(questions));
    return (
      <>
        <QuestionForm questions={questions} answers={answers} onChange={setAnswers} frozen={null} interactive />
        <output>{JSON.stringify(answers)}</output>
      </>
    );
  }
  it("shows an answer box only when answering", async () => {
    const user = userEvent.setup();
    wrap(<Form />);
    // Question 2 has no assumption, so it starts in answer mode.
    expect(screen.queryByLabelText("Answer to question 1")).toBeNull();
    expect(screen.getByLabelText("Answer to question 2")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Answer" }));
    await user.type(screen.getByLabelText("Answer to question 1"), "8080");
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent('"text":"8080"');
  });
  it("renders a frozen form read-only", () => {
    wrap(
      <QuestionForm
        questions={questions}
        answers={[]}
        onChange={() => {}}
        frozen={{ answers: [{ mode: "keep", text: "" }, { mode: "answer", text: "postgres" }], keepAll: false }}
        interactive={false}
      />,
    );
    expect(screen.getByText("Kept: 80")).toBeInTheDocument();
    expect(screen.getByText("You: postgres")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("Composer", () => {
  it("sends on Cmd+Enter but not on a plain Enter", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    wrap(<Harness api={api} />);
    const box = screen.getByRole("textbox");
    await user.type(box, "deploy nginx{Enter}");
    expect(api.send).not.toHaveBeenCalled();
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.send).mock.calls[0][0]).toBe("deploy nginx\n");
  });
  it("replies with formatted answers when a form is open", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ sessionId: "s" });
    wrap(<Harness api={api} form />);
    await user.type(screen.getByRole("textbox"), "use tls");
    await user.click(screen.getByRole("button", { name: "Send answers" }));
    expect(api.answer).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.answer).mock.calls[0][0]).toContain("Also: use tls");
  });
});
