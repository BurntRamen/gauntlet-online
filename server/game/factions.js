const FACTIONS = {
  RUMIN: {
    id: "rumin",
    name: "Rumin",
    commander: {
      name: "Kaiser, the Jewel",
      text: "Your fourth attack each turn gets +3 value."
    },
    general: {
      name: "Meerus",
      text: "After you declare your second attack each turn, your next attack this turn with value 3 or less costs 0 to declare."
    },
    city: {
      name: "Rumie, City of the Empire",
      text: "Each turn, the first two attacks you declare that share a suit with the immediately previous attack get +1 value."
    }
  },
  SHEEN: {
    id: "sheen",
    name: "Sheen",
    commander: {
      name: "Emporer Nu",
      text: "Your blocking cards get +1 value. If it's your third or later time blocking this turn, they get +2 instead."
    },
    general: {
      name: "Tang",
      text: "Each turn, when you block for the second time, gain 2 life."
    },
    city: {
      name: "Beli, Living City",
      text: "Whenever you block for the second time in a turn, your next attack with cost 10 or more gets +2 value."
    }
  },
  FRUMO: {
    id: "frumo",
    name: "Frumo",
    commander: {
      name: "Lord Commander Polea",
      text: "Once per turn, choose 1: put a card from your hand into an empty lane you control; switch up to 2 cards you control; look at 1 face-down card; or one card you control gets +1 value until end of turn."
    },
    general: {
      name: "Lafayette",
      text: "Once per turn, you may swap a face-down card in one of your lanes with a card from your hand."
    },
    city: {
      name: "Ristus, Sunken City",
      text: "Each turn, your first card played with a consecutive value of the last card played gets +2."
    }
  },
  BIZI: {
    id: "bizi",
    name: "Bizi",
    commander: {
      name: "Focus, Conductor of Progress",
      text: "Whenever you overpay for a card by 2 or more, put an acceleration counter on this. Once per turn, you may remove an acceleration counter: target card gets +1 value until end of turn."
    },
    general: {
      name: "Hera",
      text: "Once per turn: If you've played a card of a suit this turn, you may use a card of the same suit to pay 2 more than its value."
    },
    city: {
      name: "Constanti, Technology Hub",
      text: "Each turn, your first two attacks after the first that have a different suit from your previous attack get +1 value."
    }
  }
};

function listFactions() {
  return Object.values(FACTIONS).map((f) => ({
    id: f.id,
    name: f.name,
    commander: f.commander,
    general: f.general,
    city: f.city
  }));
}

function getFactionById(id) {
  return Object.values(FACTIONS).find((f) => f.id === id) || null;
}

module.exports = {
  FACTIONS,
  listFactions,
  getFactionById
};