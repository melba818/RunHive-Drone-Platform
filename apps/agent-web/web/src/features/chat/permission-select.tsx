/**
 * Managed workspaces keep their account boundary on the server. The official composer's
 * popup, labels and saving feedback are retained; a pick changes only tool approval.
 */
import { useState } from "react";
import type { ApprovalMode, SessionSandbox } from "@prismshadow/penguin-server/api";
import { Dropdown, GlyphIcon, Menu, MenuRadioItem } from "@prismshadow/penguin-ui";
import {
  PERMISSION_LEVEL_GLYPH,
  PERMISSION_LEVEL_TONE,
  approvalModePick,
  permissionLevel,
} from "../../lib/permission-level";
import type { PermissionPick } from "../../lib/permission-level";
import { S } from "../../lib/strings";
import { toneInk } from "../../lib/tone";

export function PermissionSelect({
  approvalMode: savedApprovalMode,
  approvalModes,
  sandbox,
  onChange,
  disabled,
  direction = "up",
}: {
  approvalMode: ApprovalMode;
  approvalModes: readonly ApprovalMode[];
  sandbox: SessionSandbox;
  onChange: (pick: PermissionPick) => void | Promise<unknown>;
  disabled: boolean;
  direction?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PermissionPick | null>(null);
  const approvalMode = pending?.approvalMode ?? savedApprovalMode;
  const level = permissionLevel(approvalMode, sandbox);
  const P = S.chat.permission;
  const levelName = S.chat.approvalModeNames[approvalMode] ?? approvalMode;
  const summary = [
    `${P.fs}: ${P.fsModes[sandbox.mode] ?? sandbox.mode}`,
    `${P.network}: ${P.networkModes[sandbox.network] ?? sandbox.network}`,
    `${P.approval}: ${levelName}`,
  ].join(" · ");

  const pick = (mode: ApprovalMode) => {
    if (disabled || pending !== null || !approvalModes.includes(mode)) return;
    setOpen(false);
    if (mode === approvalMode) return;
    // A managed-workspace pick never sends a sandbox preset or broadens its policy.
    const next = approvalModePick(mode);
    setPending(next);
    try {
      const saved = onChange(next);
      void Promise.resolve(saved).then(
        () => setPending(null),
        () => setPending(null),
      );
    } catch (error) {
      setPending(null);
      throw error;
    }
  };

  return (
    <Dropdown
      open={open}
      setOpen={setOpen}
      menuClass="w-max min-w-44"
      portal={{ direction, align: "left" }}
      button={
        <button
          type="button"
          aria-label={`${P.label}: ${levelName}`}
          aria-haspopup="menu"
          aria-expanded={open}
          data-tooltip={`${P.label}：${levelName}\n${summary}`}
          data-level={level}
          disabled={disabled || pending !== null}
          onClick={() => setOpen((value) => !value)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors duration-150 hover:bg-surface-muted hover:text-fg"
        >
          <GlyphIcon
            d={PERMISSION_LEVEL_GLYPH[level]}
            size={15}
            className={toneInk[PERMISSION_LEVEL_TONE[level]]}
          />
        </button>
      }
    >
      <Menu label={P.label} density="sm" className="py-1">
        {approvalModes.map((mode) => (
          <MenuRadioItem
            key={mode}
            label={S.chat.approvalModeNames[mode] ?? mode}
            checked={mode === approvalMode}
            onSelect={() => pick(mode)}
          />
        ))}
      </Menu>
    </Dropdown>
  );
}
