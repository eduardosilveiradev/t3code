import { DEFAULT_WORKSPACE_BACKDROP, type WorkspaceBackdrop } from "@t3tools/contracts/settings";

import { BackdropCanvas } from "../WorkspaceBackdrop";
import { SettingResetButton, SettingsSection } from "./settingsLayout";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

const OPTIONS: ReadonlyArray<{ value: WorkspaceBackdrop; label: string; detail: string }> = [
  { value: "none", label: "None", detail: "The plain workspace background." },
  { value: "horizon", label: "Horizon", detail: "Sunrise over the Earth, dithered." },
  { value: "aurora", label: "Aurora", detail: "A light band, blue into orange." },
  { value: "ember", label: "Ember", detail: "A light band, violet into orange." },
];

/**
 * Settings → Appearance → Background: the dithered art behind the main pane, one card per
 * choice with a live preview drawn by the same renderer as the pane. Native radios, so the
 * group is one tab stop with arrow keys between cards.
 */
export function BackgroundSection() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const current = settings.workspaceBackdrop;

  return (
    <SettingsSection
      id="workspace-backdrop"
      title="Background"
      headerAction={
        current !== DEFAULT_WORKSPACE_BACKDROP ? (
          <SettingResetButton
            label="background"
            onClick={() => updateSettings({ workspaceBackdrop: DEFAULT_WORKSPACE_BACKDROP })}
          />
        ) : null
      }
    >
      <fieldset className="backdrop-options">
        <legend className="sr-only">Workspace background</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="backdrop-option"
            data-selected={current === option.value || undefined}
          >
            <input
              type="radio"
              name="workspace-backdrop"
              value={option.value}
              checked={current === option.value}
              onChange={() => updateSettings({ workspaceBackdrop: option.value })}
              className="sr-only"
            />
            <span className="backdrop-preview" aria-hidden>
              {option.value !== "none" && <BackdropCanvas art={option.value} guardText={false} />}
            </span>
            <span className="backdrop-option-text">
              <span className="backdrop-option-label">{option.label}</span>
              <span className="backdrop-option-detail">{option.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="backdrop-note">
        Shows behind threads and the new chat page. It turns itself off when increased contrast is
        on.
      </p>
    </SettingsSection>
  );
}
