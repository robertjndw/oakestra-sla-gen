import { createRef, useState, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionContext } from "@/hooks/session-context";
import { initialState, type SessionApi, type SessionState } from "@/hooks/use-session";
import { initialAnswers, type QuestionAnswer } from "@/lib/answers";
import type { Clarification, InputFile } from "@/lib/types";
import { Composer } from "./composer";
import { composerModel, detectKind, readInputFile } from "./composer-logic";
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
    openFromHistory: noop,
    loadCandidate: noop,
    setEditorText: noop,
    resetToModel: noop,
    setSettings: noop,
    dismissPendingDraft: noop,
  };
}

function Harness({ api, form }: { api: SessionApi; form?: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<InputFile | null>(null);
  const answers = initialAnswers(questions);
  return (
    <SessionContext.Provider value={api}>
      <Composer
        text={text}
        onTextChange={setText}
        inputFile={file}
        onInputFileChange={setFile}
        form={form ? { questions, answers } : null}
        inputRef={createRef()}
      />
    </SessionContext.Provider>
  );
}

const wrap = (n: ReactNode) => render(<>{n}</>);

describe("composerModel", () => {
  const base = { sessionId: null, turnRunning: false, hasModelDraft: false, form: null, text: "", inputFile: null };
  it("cannot send nothing", () => {
    expect(composerModel(base).canSend).toBe(false);
  });
  const compose: InputFile = { name: "a.yml", text: "x", kind: "compose" };
  const sla: InputFile = { name: "sla.json", text: "{}", kind: "sla" };
  it("sends a compose file without text", () => {
    expect(composerModel({ ...base, inputFile: compose }).canSend).toBe(true);
  });
  it("sends an SLA without text and asks what should change", () => {
    const m = composerModel({ ...base, inputFile: sla });
    expect(m.canSend).toBe(true);
    expect(m.placeholder).toMatch(/^What should change\?/);
  });
  it("ignores a compose file once a session exists", () => {
    const m = composerModel({ ...base, sessionId: "s", inputFile: compose });
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
  it("makes Accept the primary action only when there is nothing else to send", () => {
    const withDraft = { ...base, sessionId: "s", hasModelDraft: true };
    expect(composerModel(withDraft).acceptPrimary).toBe(true);
    expect(composerModel({ ...withDraft, text: "add tls" }).acceptPrimary).toBe(false);
    expect(composerModel({ ...withDraft, turnRunning: true }).acceptPrimary).toBe(false);
    expect(composerModel({ ...base, sessionId: "s" }).acceptPrimary).toBe(false);
    const kept = [{ topic: "ports", question: "Which port?", assumption: "80" }];
    expect(
      composerModel({ ...withDraft, form: { questions: kept, answers: initialAnswers(kept) } }).acceptPrimary,
    ).toBe(true);
    // Question 2 has no assumption to keep, so it still needs an answer.
    expect(
      composerModel({ ...withDraft, form: { questions, answers: initialAnswers(questions) } }).acceptPrimary,
    ).toBe(false);
  });
  it("rejects oversized compose files", async () => {
    const big = new File(["a".repeat(64_001)], "big.yml");
    const res = await readInputFile(big);
    expect(res.ok).toBe(false);
    const ok = await readInputFile(new File(["services: {}"], "ok.yml"));
    expect(ok).toEqual({ ok: true, file: { name: "ok.yml", text: "services: {}", kind: "compose" } });
  });
  it("tells an SLA from a compose file by content", () => {
    expect(detectKind("sla.json", '{"applications": []}')).toBe("sla");
    expect(detectKind("whatever.txt", '{"sla_version": "v2.0"}')).toBe("sla");
    expect(detectKind("compose.json", '{"services": {}}')).toBe("compose");
    expect(detectKind("compose.yaml", "services:\n  web: {}")).toBe("compose");
    expect(detectKind("list.json", "[1, 2]")).toBe("compose");
    // Broken JSON falls back to the extension so the server reports the JSON error.
    expect(detectKind("sla.json", "{broken")).toBe("sla");
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
    await user.click(screen.getByRole("button", { name: "Change the assumption for question 1" }));
    await user.type(screen.getByLabelText("Answer to question 1"), "8080");
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent('"text":"8080"');
  });
  it("shows the assumption again when an empty answer box loses focus", async () => {
    const user = userEvent.setup();
    wrap(<Form />);
    await user.click(screen.getByRole("button", { name: "Change the assumption for question 1" }));

    await user.click(document.body);

    expect(screen.queryByLabelText("Answer to question 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Change the assumption for question 1" })).toBeInTheDocument();
  });
  it("keeps a typed answer open when the box loses focus", async () => {
    const user = userEvent.setup();
    wrap(<Form />);
    await user.click(screen.getByRole("button", { name: "Change the assumption for question 1" }));
    await user.type(screen.getByLabelText("Answer to question 1"), "8080");

    await user.click(document.body);

    expect(screen.getByLabelText("Answer to question 1")).toHaveValue("8080");
  });
  it("lets keyboard users tab from an empty box to the keep link", async () => {
    const user = userEvent.setup();
    wrap(<Form />);
    await user.click(screen.getByRole("button", { name: "Change the assumption for question 1" }));

    await user.tab();

    expect(screen.getByRole("button", { name: "Keep the assumption (80) instead" })).toHaveFocus();
  });
  it("goes back to the assumption and returns focus to Change", async () => {
    const user = userEvent.setup();
    wrap(<Form />);
    await user.click(screen.getByRole("button", { name: "Change the assumption for question 1" }));
    expect(screen.getByLabelText("Answer to question 1")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Keep the assumption (80) instead" }));

    expect(screen.queryByLabelText("Answer to question 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Change the assumption for question 1" })).toHaveFocus();
    expect(screen.getByRole("status", { hidden: true })).toHaveTextContent('"mode":"keep"');
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
  it("uploads an existing SLA and sends it with the first message", async () => {
    const user = userEvent.setup();
    const api = fakeApi();
    wrap(<Harness api={api} />);
    const sla = '{"applications": [{"application_name": "web"}]}';
    await user.upload(screen.getByLabelText("Docker compose file or SLA"), new File([sla], "my-sla.json"));
    expect(await screen.findByTestId("file-chip-kind")).toHaveTextContent("SLA");
    expect(screen.getByTestId("file-chip-name")).toHaveTextContent("my-sla.json");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(api.send).toHaveBeenCalledWith("", { name: "my-sla.json", text: sla, kind: "sla" });
  });
  it("sends an SLA reopened from the history as it is in the editor", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ historySeed: "shop", editedSla: '{"edited":true}' });
    wrap(<Harness api={api} />);
    expect(screen.getByTestId("file-chip-kind")).toHaveTextContent("From history");
    expect(screen.getByTestId("file-chip-name")).toHaveTextContent("shop");
    await user.click(screen.getByRole("button", { name: "Generate draft" }));
    expect(api.send).toHaveBeenCalledWith("", {
      name: "shop",
      text: '{"edited":true}',
      kind: "sla",
      origin: "history",
    });
  });
  it("starts over when the SLA from the history is removed", async () => {
    const user = userEvent.setup();
    const api = fakeApi({ historySeed: "shop", editedSla: "{}" });
    wrap(<Harness api={api} />);
    await user.click(screen.getByRole("button", { name: "Remove shop" }));
    expect(api.newSession).toHaveBeenCalled();
  });
  it("removes the attached file", async () => {
    const user = userEvent.setup();
    wrap(<Harness api={fakeApi()} />);
    await user.upload(screen.getByLabelText("Docker compose file or SLA"), new File(["services: {}"], "c.yml"));
    await user.click(await screen.findByRole("button", { name: "Remove c.yml" }));
    expect(screen.queryByTestId("file-chip-name")).toBeNull();
  });
});
