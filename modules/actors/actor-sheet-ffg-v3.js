import { ActorSheetFFGV2 } from "./actor-sheet-ffg-v2.js";

export class ActorSheetFFGV3 extends ActorSheetFFGV2 {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["starwarsffg", "sheet", "actor", "v2", "v3"],
    });
  }

  getSheetOptionDefault(optionName, fallback) {
    switch (optionName) {
      case "enableObligation":
      case "enableDuty":
        return false;
      case "enableEditMode":
        return true;
      default:
        return super.getSheetOptionDefault(optionName, fallback);
    }
  }

  getSheetOptionValue(optionName, fallback) {
    if (optionName === "enableEditMode") {
      return true;
    }
    return super.getSheetOptionValue(optionName, fallback);
  }

  useEditModeSheetOption() {
    return false;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".v3-adjustable-field").on("click", async (event) => {
      await this._adjustV3Field(event, 1);
    });

    html.find(".v3-adjustable-field").on("contextmenu", async (event) => {
      await this._adjustV3Field(event, -1);
    });
  }

  async _adjustV3Field(event, delta) {
    event.preventDefault();
    event.stopPropagation();

    if (!game.user.isGM || !(event.ctrlKey || event.metaKey)) {
      return;
    }

    const target = event.currentTarget;
    const path = target.dataset.adjustPath;
    const min = Number(target.dataset.adjustMin ?? 0);
    const max = target.dataset.adjustMax ? Number(target.dataset.adjustMax) : null;
    const fallback = Number(target.dataset.adjustDefault ?? 0);

    const rawActor = this.actor.toObject();
    const rawValue = Number(foundry.utils.getProperty(rawActor, path) ?? fallback);
    const currentValue = Number(foundry.utils.getProperty(this.actor, path) ?? fallback);

    if (delta > 0 && max !== null && currentValue >= max) {
      return;
    }

    const nextValue = Math.max(min, rawValue + delta);
    if (nextValue === rawValue) {
      return;
    }

    await this.actor.update({
      [path]: nextValue,
    });
  }
}
