import {
  DEFAULT_WORKSPACE_BACKDROP,
  DEFAULT_WORKSPACE_BACKDROP_DITHER,
  MAX_WORKSPACE_BACKDROP_DITHER,
  MIN_WORKSPACE_BACKDROP_DITHER,
  type WorkspaceBackdrop,
} from "@t3tools/contracts/settings";
import type { CSSProperties } from "react";

import { BackdropCanvas } from "../WorkspaceBackdrop";
import { isBackdropPhoto } from "../WorkspaceBackdrop.logic";
import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

const OPTIONS: ReadonlyArray<{ value: WorkspaceBackdrop; label: string; detail: string }> = [
  { value: "none", label: "None", detail: "The plain workspace background." },
  { value: "horizon", label: "Horizon", detail: "Fiery sunset over the South Atlantic." },
  { value: "sunset-limb", label: "Sunset limb", detail: "A low orange band along the horizon." },
  { value: "red-sun", label: "Red sun", detail: "The sun glowing red under a thin limb." },
  { value: "sunrise-bands", label: "Sunrise bands", detail: "Layers from deep blue into orange." },
  { value: "bright-limb", label: "Bright limb", detail: "A steep diagonal of light." },
  { value: "crescent", label: "Crescent", detail: "A crescent moon over the sunrise." },
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
  const dither = settings.workspaceBackdropDither;
  const ditherRatio =
    (dither - MIN_WORKSPACE_BACKDROP_DITHER) /
    (MAX_WORKSPACE_BACKDROP_DITHER - MIN_WORKSPACE_BACKDROP_DITHER);
  const ditherSliderStyle = {
    "--settings-slider-progress": `${ditherRatio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - ditherRatio}rem`,
  } as CSSProperties;

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
              {option.value !== "none" && (
                <BackdropCanvas art={option.value} dither={dither} guardText={false} />
              )}
            </span>
            <span className="backdrop-option-text">
              <span className="backdrop-option-label">{option.label}</span>
              <span className="backdrop-option-detail">{option.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {current !== "none" && isBackdropPhoto(current) ? (
        <SettingsRow
          title="Dither"
          description="Pixel size of the dither pattern. Off shows the photo as it is."
          resetAction={
            dither !== DEFAULT_WORKSPACE_BACKDROP_DITHER ? (
              <SettingResetButton
                label="dither"
                onClick={() =>
                  updateSettings({ workspaceBackdropDither: DEFAULT_WORKSPACE_BACKDROP_DITHER })
                }
              />
            ) : null
          }
          control={
            <div className="flex w-full items-center gap-3 sm:w-52">
              <output
                className="min-w-12 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
                htmlFor="backdrop-dither"
              >
                {dither === 0 ? "Off" : `${dither / 2}px`}
              </output>
              <input
                aria-label="Dither size"
                aria-valuetext={dither === 0 ? "Off" : `${dither / 2} pixels`}
                className="settings-slider min-w-0 flex-1"
                id="backdrop-dither"
                max={MAX_WORKSPACE_BACKDROP_DITHER}
                min={MIN_WORKSPACE_BACKDROP_DITHER}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  if (
                    Number.isInteger(next) &&
                    next >= MIN_WORKSPACE_BACKDROP_DITHER &&
                    next <= MAX_WORKSPACE_BACKDROP_DITHER
                  ) {
                    updateSettings({ workspaceBackdropDither: next });
                  }
                }}
                step={1}
                style={ditherSliderStyle}
                type="range"
                value={dither}
              />
            </div>
          }
        />
      ) : null}
      <p className="backdrop-note">
        Shows behind threads and the new chat page. It turns itself off when increased contrast is
        on.
      </p>
    </SettingsSection>
  );
}
