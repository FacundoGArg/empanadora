export type EvalExpectation = {
  contains?: string[];
  notContains?: string[];
  regex?: string[];
};

export type EvalCase = {
  id: string;
  system?: string;
  user: string;
  expect: EvalExpectation;
};

export const evalCases: EvalCase[] = [
  {
    id: "menu-basic",
    system: "Responde en una frase corta.",
    user: "Que empanadas tienen?",
    expect: {
      regex: ["carne", "pollo", "queso"],
    },
  },
  {
    id: "promos-basic",
    user: "Que promociones hay?",
    expect: {
      regex: ["12", "6", "bebida"],
    },
  },
];
