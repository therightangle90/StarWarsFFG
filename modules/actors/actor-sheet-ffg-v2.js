import { ActorSheetFFG } from "./actor-sheet-ffg.js";

export class ActorSheetFFGV2 extends ActorSheetFFG {
  constructor(...args) {
    super(...args);
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["starwarsffg", "sheet", "actor", "v2"],
      template: "systems/starwarsffg/templates/actors/ffg-character-sheet.html",
      width: 800,
      height: 980,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "characteristics" }],
      scrollY: [".tableWithHeader", ".tab", ".skillsGrid", ".skillsTablesGrid"],
    });
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
  }
}
