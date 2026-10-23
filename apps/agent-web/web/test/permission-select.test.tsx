import { Children, createElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApprovalMode, SessionSandbox } from "@prismshadow/penguin-server/api";
import { PermissionSelect } from "../src/features/chat/permission-select";
import { APPROVAL_MODES, approvalModeChoices } from "../src/features/chat/approval-mode";
import { S, setActiveStrings, zh } from "../src/lib/strings";
import { en } from "../src/lib/strings-en";

interface DropdownCapture {
  button: ReactNode;
  children: ReactNode;
  portal?: { direction: "up" | "down"; align: "left" | "right" };
  menuClass?: string;
}
let dropdown: DropdownCapture | null = null;

vi.mock("@prismshadow/penguin-ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@prismshadow/penguin-ui")>();
  return {
    ...original,
    Dropdown: (props: DropdownCapture) => {
      dropdown = props;
      // Expose the rows without mounting a DOM. Browser QA covers the actual body portal,
      // focus, clipping ancestors and the pending-save state.
      return createElement("div", null, props.button, props.children);
    },
  };
});

const WORKSPACE: SessionSandbox = { mode: "workspace-write", network: "open" };
type Choice = { label: string; checked: boolean; onSelect: () => void };
function choices(): ReactElement<Choice>[] {
  if (!dropdown || !isValidElement<{ children: ReactNode }>(dropdown.children)) {
    throw new Error("Permission menu did not render");
  }
  return Children.toArray(dropdown.children.props.children).filter(
    (child): child is ReactElement<Choice> => isValidElement<Choice>(child),
  );
}
function render({
  mode = "always-ask",
  modes = APPROVAL_MODES,
  disabled = false,
  direction = "up",
  onChange = vi.fn(),
}: {
  mode?: ApprovalMode;
  modes?: readonly ApprovalMode[];
  disabled?: boolean;
  direction?: "up" | "down";
  onChange?: (pick: { approvalMode: ApprovalMode }) => void | Promise<unknown>;
} = {}) {
  dropdown = null;
  return renderToStaticMarkup(
    <PermissionSelect
      approvalMode={mode}
      approvalModes={modes}
      sandbox={WORKSPACE}
      onChange={onChange}
      disabled={disabled}
      direction={direction}
    />,
  );
}

afterEach(() => setActiveStrings(zh));

describe("managed-workspace approval picker", () => {
  it.each(["up", "down"] as const)("uses the official body-portal docking for %s", (direction) => {
    render({ direction });
    expect(dropdown?.portal).toEqual({ direction, align: "left" });
    expect(dropdown?.menuClass).toBe("w-max min-w-44");
  });

  it("uses the official icon-only button and complete Chinese approval labels", () => {
    const html = render();
    expect(html).toContain(`aria-label="${S.chat.permission.label}: ${S.chat.approvalModeNames["always-ask"]}"`);
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('data-level="partial"');
    expect(choices().map((row) => row.props.label)).toEqual(
      APPROVAL_MODES.map((mode) => S.chat.approvalModeNames[mode]),
    );
    expect(choices().filter((row) => row.props.checked).map((row) => row.props.label)).toEqual([
      S.chat.approvalModeNames["always-ask"],
    ]);
  });

  it("switches only tool approval, never sending a broader filesystem or network preset", () => {
    const onChange = vi.fn();
    render({ onChange });
    choices().find((row) => row.props.label === S.chat.approvalModeNames["allow-all"])!.props.onSelect();
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith({ approvalMode: "allow-all" });
    expect(WORKSPACE).toEqual({ mode: "workspace-write", network: "open" });
  });

  it("does not issue a save for the already-selected mode", () => {
    const onChange = vi.fn();
    render({ onChange });
    choices().find((row) => row.props.checked)!.props.onSelect();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("blocks picks while its caller is saving", () => {
    const onChange = vi.fn();
    expect(render({ disabled: true, onChange })).toContain('disabled=""');
    choices().find((row) => !row.props.checked)!.props.onSelect();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("retains official organizational-session mode restrictions", () => {
    const modes = approvalModeChoices("org", "allow-all");
    render({ mode: "allow-all", modes });
    expect(choices().map((row) => row.props.label)).not.toContain(
      S.chat.approvalModeNames["always-ask"],
    );
  });

  it("uses the official English names after a locale change", () => {
    setActiveStrings(en);
    render({ mode: "read-only" });
    expect(choices().map((row) => row.props.label)).toEqual(
      APPROVAL_MODES.map((mode) => en.chat.approvalModeNames[mode]),
    );
  });

  it("handles a rejected asynchronous save without an unhandled rejection", async () => {
    const onChange = vi.fn(() => Promise.reject(new Error("Request rejected")));
    render({ onChange });
    choices().find((row) => !row.props.checked)!.props.onSelect();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onChange).toHaveBeenCalledOnce();
  });
});
