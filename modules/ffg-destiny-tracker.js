import { GroupManager } from "./groupmanager-ffg.js";

/**
 * A specialized form used to pop out the editor.
 * @extends {FormApplication}
 *
 * OPTIONS:
 *
 *
 */
export default class DestinyTracker extends FormApplication {
  constructor(object={}, options={}) {
    super(object, options);

    this.destinyQueue = [];
    this.isRunningQueue = false;
    this._rolledActorIds = new Set();
    if (options?.menu) {
      this.menu = options.menu;
    }
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "destiny-tracker",
      classes: ["starwarsffg"],
      title: "Destiny Tracker",
      template: "systems/starwarsffg/templates/ffg-destiny-tracker.html",
    });
  }

  /** @override */
  getData() {
    // Get current value
    let destinyPool = { light: game.settings.get("starwarsffg", "dPoolLight"), dark: game.settings.get("starwarsffg", "dPoolDark") };
    let destinyPoolLabel = { light: game.settings.get("starwarsffg", "destiny-pool-light"), dark: game.settings.get("starwarsffg", "destiny-pool-dark") };

    //this.position.width = 150;
    //this.position.height = 105;

    // filter menu based on role.

    const menu = (this.menu ?? []).filter((m) => game.user.hasRole(m.minimumRole) || !m.minimumRole);

    let destinyRollPending = false;
    try {
      destinyRollPending = game.settings.get("starwarsffg", "destinyRollPending") ?? false;
    } catch (e) {
      // setting not yet registered; default to false
    }
    const ownedChars = this._getOwnedCharacterActors(game.user);
    const showDestinyRollButton = !game.user.isGM && destinyRollPending && ownedChars.length > 0 && ownedChars.some((a) => !this._hasRolled(a));

    // Return data
    return {
      destinyPool,
      destinyPoolLabel,
      isGM: game.user.isGM,
      menu,
      theme: game.settings.get("starwarsffg", "dicetheme"),
      showDestinyRollButton,
    };
  }

  /* -------------------------------------------- */

  /** @override */
  _updateObject(event, formData) {};

  /** @override */
  async close(options = {}) {};

  /** @override */
  activateListeners(html) {
    // future functionality to allow multiple menu items to be passed in

    $.expr.filters.offscreen = function (el) {
      var rect = el.getBoundingClientRect();
      return rect.x + rect.width < 0 || rect.y + rect.height < 0 || rect.y + rect.height > window.innerHeight || rect.x + rect.width > window.innerWidth || rect.x > window.innerWidth || rect.y > window.innerHeight;
    };

    html.find(".dropbtn").click((event) => {
      const id = `#${$(event.currentTarget).attr("id")}Content`;
      $(html.find(id)).toggleClass("show");

      if ($(".dropdown-content").is(":offscreen")) {
        $(html.find(id)).addClass("vertical");
      } else {
        $(html.find(id)).removeClass("vertical");
      }
    });

    html.find(".dropdown-content a").click((event) => {
      event.preventDefault();
      event.stopPropagation();

      const index = event.currentTarget.dataset.value;
      this.menu[index].callback();
    });

    html.find(".destiny-points").click(async (event) => {
      const pointType = event.currentTarget.dataset.group;
      var typeName = null;
      const add = event.shiftKey;
      const remove = event.ctrlKey || event.metaKey;
      var flipType = null;
      var actionType = null;
      if (pointType == "dPoolLight") {
        flipType = "dPoolDark";
        typeName = game.i18n.localize(game.settings.get("starwarsffg", "destiny-pool-light"));
      } else {
        flipType = "dPoolLight";
        typeName = game.i18n.localize(game.settings.get("starwarsffg", "destiny-pool-dark"));
      }
      var messageText;

      if (!add && !remove) {
        if (game.settings.get("starwarsffg", pointType) == 0) {
          return;
        } else {
          let pool = { light: 0, dark: 0 };
          if (flipType == "dPoolLight") {
            pool.light = game.settings.get("starwarsffg", flipType) + 1;
            pool.dark = game.settings.get("starwarsffg", pointType) - 1;
          } else if (flipType == "dPoolDark") {
            pool.dark = game.settings.get("starwarsffg", flipType) + 1;
            pool.light = game.settings.get("starwarsffg", pointType) - 1;
          }

          if (game.user.isGM) {
            game.settings.set("starwarsffg", "dPoolLight", pool.light);
            game.settings.set("starwarsffg", "dPoolDark", pool.dark);
          } else {
            await game.socket.emit("system.starwarsffg", { pool });
          }

          messageText = `<div class="destiny-flip ${flipType}">
          <div class="destiny-title">${game.i18n.localize("SWFFG.DestinyFlipMessage")}: <span class="${typeName}">${typeName}</span></div>
          <div class="destiny-left ${flipType !== "dPoolDark"} dark">${game.i18n.localize(game.settings.get("starwarsffg", "destiny-pool-dark"))} ${game.i18n.localize("SWFFG.DestinyFlipRemaining")}: ${pool.dark}</div>
          <div class="destiny-left ${flipType !== "dPoolLight"} light">${game.i18n.localize(game.settings.get("starwarsffg", "destiny-pool-light"))} ${game.i18n.localize("SWFFG.DestinyFlipRemaining")}: ${pool.light}</div>
          </div>`;
        }
      } else if (add) {
        if (!game.user.isGM) {
          ui.notifications.warn("Only GMs can add or remove points from the Destiny Pool.");
          return;
        }
        const setting = game.settings.settings.get(`starwarsffg.${pointType}`);
        game.settings.set("starwarsffg", pointType, game.settings.get("starwarsffg", pointType) + 1);
        messageText = "Added a " + typeName + " point.";
      } else if (remove) {
        if (!game.user.isGM) {
          ui.notifications.warn("Only GMs can add or remove points from the Destiny Pool.");
          return;
        }
        const setting = game.settings.settings.get(`starwarsffg.${pointType}`);
        game.settings.set("starwarsffg", pointType, game.settings.get("starwarsffg", pointType) - 1);
        messageText = "Removed a " + typeName + " point.";
      }

      ChatMessage.create({
        user: game.user.id,
        content: messageText,
      });
    });

    // handle previously created roll destiny chat messages
    $(".ffg-destiny-roll").on("click", this.OnClickRollDestiny.bind(this));

    // click handler for the destiny roll button in the tracker
    html.find("#destinyRollButton").on("click", this.OnClickRollDestiny.bind(this));

    // Update destiny tracker position accounting for sidebar state; clean up
    // any listeners from a previous render before registering new ones.
    if (this._boundUpdateDestinyPosition) {
      Hooks.off("collapseSidebar", this._boundUpdateDestinyPosition);
      window.removeEventListener("resize", this._boundUpdateDestinyPosition);
    }
    this._boundUpdateDestinyPosition = this._updateDestinyPosition.bind(this);
    this._boundUpdateDestinyPosition();
    Hooks.on("collapseSidebar", this._boundUpdateDestinyPosition);
    window.addEventListener("resize", this._boundUpdateDestinyPosition);

    // setup chat hook for destiny roll
    Hooks.on("renderChatMessage", (app, html, messageData) => {
      html.on("click", ".ffg-destiny-roll", this.OnClickRollDestiny.bind(this));
    });

    // re-show the destiny roll button when the GM requests a new roll
    if (!game.user.isGM) {
      Hooks.on("starwarsffg.destinyRollPendingChanged", (value) => {
        if (value) {
          this._showDestinyRollButton();
        }
      });
    }

    // setup socket handler for checking destiny roll
    game.socket.on("system.starwarsffg", async (...args) => {
      if (args[0]?.canIRollDestinyResponse === game.user.id && !game.user.isGM) {
        if (args[0]?.denied) {
          ui.notifications.warn(game.i18n.localize("SWFFG.DestinyRollOwnershipDenied"));
          return;
        }
        if (!args[0]?.rolled) {
          const actorId = args[0]?.actorId;
          const actor = actorId ? game.actors.get(actorId) : null;
          if (!actor || actor.type !== "character") {
            ui.notifications.warn(game.i18n.localize("SWFFG.DestinyRollActorMissing"));
            return;
          }
          const roll = await this._rollDestiny();
          const modifiers = actor ? this._getActorDestinyModifiers(actor) : { light: 0, dark: 0 };
          await game.socket.emit("system.starwarsffg", {
            destiny: game.user.id,
            actorId: actor.id,
            light: roll.ffg.light + modifiers.light,
            dark: roll.ffg.dark + modifiers.dark
          });
          this._rolledActorIds.add(actor.id);
          this._checkAndHideRollButton();
        } else {
          ui.notifications.info(game.i18n.localize("SWFFG.CharacterDestinyAlreadyDecided"));
          const actorId = args[0]?.actorId;
          if (actorId) {
            this._rolledActorIds.add(actorId);
            this._checkAndHideRollButton();
          }
        }
      }
    });

    if (game.user.isGM) {
      // socket handler for GM
      game.socket.on("system.starwarsffg", async (...args) => {
        // check if this is the GM intended to answer the question or not
        if (game.user.id !== game.users.activeGM?.id) {
          // limit rolling to a single GM
          return;
        }
        // Can user roll destiny? Or have they already rolled
        if (args[0]?.canIRollDestiny) {
          const userId = args[0]?.canIRollDestiny;
          const actorId = args[0]?.actorId;
          const user = game.users.get(userId);
          const actor = actorId ? game.actors.get(actorId) : null;
          if (!user || !actor || actor.type !== "character" || !actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) {
            await game.socket.emit("system.starwarsffg", {
              canIRollDestinyResponse: userId,
              actorId,
              actorName: actor?.name || null,
              rolled: false,
              denied: true,
            });
            return;
          }

          let rolled = false;

          rolled = this._hasRolled(actor);

          await game.socket.emit("system.starwarsffg", {
            canIRollDestinyResponse: userId,
            actorId: actor.id,
            actorName: actor.name,
            rolled,
          });
        }

        // Handle user initiated destiny pool flips
        if (args[0]?.pool) {
          const light = await game.settings.get("starwarsffg", "dPoolLight");
          const dark = await game.settings.get("starwarsffg", "dPoolDark");

          const request = {
            id: "player",
            type: "destiny-flip",
            light: +light - +args[0].pool.light,
            dark: +dark - +args[0].pool.dark,
          };

          // only allow one player flip at a time.
          if (!this.destinyQueue.find((q) => q.id === args[0].destiny)) {
            this.destinyQueue.push(request);
          }
        }

        // Handle user report for initial Destiny roll
        if (args[0]?.destiny) {
          const rollActorId = args[0].actorId || game.users.get(args[0].destiny)?.character?.id;
          const request = {
            id: `${args[0].destiny}:${rollActorId}`,
            type: "destiny-roll",
            actorId: rollActorId,
            light: args[0].light,
            dark: args[0].dark,
          };

          // make sure only one player destiny roll is queued.
          if (!this.destinyQueue.find((q) => q.id === request.id) && CONFIG.FFG.DestinyGM === game.user.id) {
            this.destinyQueue.push(request);
          }
        }

        if (!this.isRunningQueue) {
          this._processDestinyRequests();
        }
      });
    }
  }

  // Click event for Roll Destiny Chat Message
  async OnClickRollDestiny(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!game.user.isGM) {
      const actor = await this._promptOwnedCharacterForDestinyRoll();
      if (!actor) {
        return;
      }
      await game.socket.emit("system.starwarsffg", { canIRollDestiny: game.user.id, actorId: actor.id });
    }

    if (game.user.isGM) {
      const roll = await this._rollDestiny();
      const actorId = game.user.character?.id;
      if (!actorId) {
        ui.notifications.warn(game.i18n.localize("SWFFG.DestinyRollAssignCharacter"));
        return;
      }
      const actor = game.actors.get(actorId);
      const modifiers = actor ? this._getActorDestinyModifiers(actor) : { light: 0, dark: 0 };
      const totalLight = roll.ffg.light + modifiers.light;
      const totalDark = roll.ffg.dark + modifiers.dark;
      await this._setActorDestiny(actorId, totalLight, totalDark);
      const light = await game.settings.get("starwarsffg", "dPoolLight");
      const dark = await game.settings.get("starwarsffg", "dPoolDark");
      await game.settings.set("starwarsffg", "dPoolLight", light + totalLight);
      await game.settings.set("starwarsffg", "dPoolDark", dark + totalDark);
    }
  }

  async _processDestinyRequests() {
    CONFIG.logger.debug(`Processing ${this.destinyQueue.length} Destiny Requests`);

    while (this.destinyQueue.length > 0) {
      const request = this.destinyQueue.shift();
      CONFIG.logger.debug(`Processing Destiny Request (${request.type}) from User ${request.id}`, request);

      const light = await game.settings.get("starwarsffg", "dPoolLight");
      const dark = await game.settings.get("starwarsffg", "dPoolDark");

      switch (request.type) {
        case "destiny-roll": {
          const actorId = request.actorId || this._resolveCharacterActorIdForUser(request.id);
          if (!actorId) {
            break;
          }
          await this._setActorDestiny(actorId, request.light, request.dark);
          await game.settings.set("starwarsffg", "dPoolLight", light + request.light);
          await game.settings.set("starwarsffg", "dPoolDark", dark + request.dark);
          break;
        }
        case "destiny-flip": {
          await game.settings.set("starwarsffg", "dPoolLight", light - request.light);
          game.settings.set("starwarsffg", "dPoolDark", dark - request.dark);
          break;
        }
      }
    }

    CONFIG.logger.debug(`Done Processing Destiny Requests`);
    this.isRunningQueue = false;
  }

  async _rollDestiny() {
    const pool = new DicePoolFFG({
      force: 1,
    });

    const roll = new game.ffg.RollFFG(pool.renderDiceExpression());
    await roll.toMessage({
      user: game.user.id,
      flavor: `${game.i18n.localize("SWFFG.Rolling")} ${game.i18n.localize("SWFFG.DestinyPool")}...`,
    });

    return roll;
  }

  async _setActorDestiny(actorId, light, dark) {
    if (!actorId) {
      return;
    }
    const actor = game.actors.get(actorId);
    if (!actor || actor.type !== "character") {
      return;
    }
    await actor.setFlag("starwarsffg", "destinyPips", {
      light: Math.max(Number(light ?? 0), 0),
      dark: Math.max(Number(dark ?? 0), 0),
    });
  }

  _resolveCharacterActorIdForUser(userId) {
    const user = game.users.get(userId);
    if (user?.character?.id) {
      return user.character.id;
    }
    if (!user) {
      return null;
    }
    const ownedCharacter = game.actors.find((actor) => actor.type === "character" && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER));
    return ownedCharacter?.id;
  }

  _getActorDestinyModifiers(actor) {
    let light = 0;
    let dark = 0;
    for (const item of actor.items) {
      if (!item.system?.attributes) continue;
      for (const attr of Object.values(item.system.attributes)) {
        if (attr.modtype !== "Destiny Pool") continue;
        const val = parseInt(attr.value, 10) || 0;
        if (attr.mod === "Light") light += val;
        else if (attr.mod === "Dark") dark += val;
      }
    }
    return { light, dark };
  }

  _updateDestinyPosition(_sidebar, collapsed) {
    const isCollapsed = typeof collapsed === "boolean" ? collapsed : (ui.sidebar?.collapsed ?? false);
    const sidebarWidth = isCollapsed ? 25 : 300;
    const centerLeft = (window.innerWidth - sidebarWidth) / 2;
    const el = document.getElementById("destiny-tracker");
    if (el) {
      el.style.setProperty("left", `${centerLeft}px`, "important");
      el.style.setProperty("transform", "translateX(-50%)", "important");
    }
  }

  _showDestinyRollButton() {
    this._rolledActorIds = new Set();
    const btn = document.getElementById("destinyRollButton");
    if (btn) btn.style.display = "";
  }

  _checkAndHideRollButton() {
    const ownedChars = this._getOwnedCharacterActors(game.user);
    if (ownedChars.length > 0 && ownedChars.every((actor) => this._rolledActorIds.has(actor.id) || this._hasRolled(actor))) {
      const btn = document.getElementById("destinyRollButton");
      if (btn) btn.style.display = "none";
    }
  }

  _hasRolled(actor) {
    const pips = actor.getFlag("starwarsffg", "destinyPips");
    return pips != null && (pips.light > 0 || pips.dark > 0);
  }

  _getOwnedCharacterActors(user) {
    return game.actors.filter((actor) =>
      actor.type === "character"
      && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
    );
  }

  async _promptOwnedCharacterForDestinyRoll() {
    const ownedCharacters = this._getOwnedCharacterActors(game.user);
    if (ownedCharacters.length === 0) {
      ui.notifications.warn(game.i18n.localize("SWFFG.DestinyRollNoOwnedCharacters"));
      return null;
    }
    if (ownedCharacters.length === 1) {
      return ownedCharacters[0];
    }

    const options = ownedCharacters.map((actor) => `<option value="${actor.id}">${actor.name}</option>`).join("");
    return await new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("SWFFG.ChooseCharacterForDestinyRoll"),
        content: `<form><div class="form-group"><label>Character:</label><select name="actorId">${options}</select></div></form>`,
        buttons: {
          roll: {
            label: game.i18n.localize("SWFFG.ButtonRoll"),
            callback: (html) => {
              const actorId = html.find('select[name="actorId"]').val();
              resolve(game.actors.get(actorId) || null);
            },
          },
          cancel: {
            label: game.i18n.localize("Cancel"),
            callback: () => resolve(null),
          },
        },
        default: "roll",
        close: () => resolve(null),
      }).render(true);
    });
  }
}
